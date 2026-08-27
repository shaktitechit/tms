import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../errors.js';
import { ERROR_CODES } from '../constants.js';
import type { AppEnv } from './env.js';
import type { Logger } from './logger.js';

export interface ObjectMetadata {
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
}

export interface StorageDownloadOptions {
  /** HTTP/S3 Range header value, e.g. `bytes=0-1023`. */
  range?: string;
}

export interface StorageService {
  ensureBucket(): Promise<void>;
  upload(
    key: string,
    body: Buffer | Uint8Array | Readable,
    options?: { contentType?: string; contentLength?: number },
  ): Promise<void>;
  uploadFile(localPath: string, key: string, contentType?: string): Promise<void>;
  download(key: string, options?: StorageDownloadOptions): Promise<Readable>;
  downloadToFile(key: string, destination: string): Promise<void>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<ObjectMetadata>;
  getPublicUrl(key: string): string;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export class S3CompatibleStorage implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(
    env: Pick<
      AppEnv,
      | 'MINIO_ENDPOINT'
      | 'MINIO_PORT'
      | 'MINIO_ACCESS_KEY'
      | 'MINIO_SECRET_KEY'
      | 'MINIO_BUCKET'
      | 'MINIO_USE_SSL'
      | 'MINIO_REGION'
      | 'MINIO_PUBLIC_URL'
    >,
    private readonly logger: Logger,
  ) {
    const protocol = env.MINIO_USE_SSL ? 'https' : 'http';
    this.bucket = env.MINIO_BUCKET;
    this.publicBaseUrl = env.MINIO_PUBLIC_URL || `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
    this.client = new S3Client({
      region: env.MINIO_REGION,
      endpoint: `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
      credentials: {
        accessKeyId: env.MINIO_ACCESS_KEY,
        secretAccessKey: env.MINIO_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.info({ bucket: this.bucket }, 'Created object storage bucket');
    }
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | Readable,
    options: { contentType?: string; contentLength?: number } = {},
  ): Promise<void> {
    try {
      if (body instanceof Readable) {
        const upload = new Upload({
          client: this.client,
          params: {
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: options.contentType,
            ContentLength: options.contentLength,
          },
        });
        await upload.done();
        return;
      }

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
        }),
      );
    } catch (error) {
      this.logger.error({ err: error, key }, 'Storage upload failed');
      throw new AppError('Failed to upload object', ERROR_CODES.STORAGE_ERROR, 502);
    }
  }

  async uploadFile(localPath: string, key: string, contentType?: string): Promise<void> {
    const fileStat = await stat(localPath);
    const stream = createReadStream(localPath);
    await this.upload(key, stream, { contentType, contentLength: fileStat.size });
  }

  async download(key: string, options: StorageDownloadOptions = {}): Promise<Readable> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...(options.range ? { Range: options.range } : {}),
        }),
      );
      if (!response.Body) {
        throw new AppError('Object has no body', ERROR_CODES.STORAGE_ERROR, 502);
      }
      return response.Body as Readable;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ err: error, key, range: options.range }, 'Storage download failed');
      throw new AppError('Failed to download object', ERROR_CODES.STORAGE_ERROR, 502);
    }
  }

  async downloadToFile(key: string, destination: string): Promise<void> {
    const { createWriteStream } = await import('node:fs');
    const { pipeline } = await import('node:stream/promises');
    const body = await this.download(key);
    await pipeline(body, createWriteStream(destination));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async deletePrefix(prefix: string): Promise<number> {
    let deleted = 0;
    let continuationToken: string | undefined;

    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const objects = (listed.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => Boolean(key))
        .map((Key) => ({ Key }));

      if (objects.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects, Quiet: true },
          }),
        );
        deleted += objects.length;
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);

    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.getMetadata(key);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
      };
    } catch (error) {
      throw new AppError('Object not found', ERROR_CODES.NOT_FOUND, 404, error);
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${this.bucket}/${key}`;
  }

  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}
