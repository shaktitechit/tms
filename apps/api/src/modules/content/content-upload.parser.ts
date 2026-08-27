import { PassThrough } from 'node:stream';
import Busboy from 'busboy';
import type { Request } from 'express';
import { AppError, ERROR_CODES } from '@video/shared';

export interface ParsedContentUpload {
  title: string;
  description: string;
  lessonId: string;
  filename: string;
  mimeType: string;
  /** Exact file bytes when known; 0 if not yet counted. Never use request Content-Length. */
  size: number;
  stream: PassThrough | null;
  extras: Record<string, string>;
}

/**
 * Parses multipart content uploads.
 * When a file is present, resolves as soon as the file part starts so the
 * consumer can drain the stream (avoids PassThrough backpressure deadlock).
 */
export function parseContentUpload(
  req: Request,
  options: {
    maxSize: number;
    allowedMimePrefixes?: string[];
    allowedMimeTypes?: string[];
    fileFieldNames?: string[];
    requireFile?: boolean;
  },
): Promise<ParsedContentUpload> {
  const fileFieldNames = options.fileFieldNames ?? ['file'];
  const requireFile = options.requireFile !== false;

  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      reject(
        new AppError('Content-Type must be multipart/form-data', ERROR_CODES.VALIDATION_ERROR, 400),
      );
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: options.maxSize,
        fields: 20,
      },
    });

    const fields: Record<string, string> = {};
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      req.unpipe(busboy);
      reject(error);
    };

    const buildPayload = (file: {
      filename: string;
      mimeType: string;
      stream: PassThrough;
      size: number;
    } | null): ParsedContentUpload => ({
      title: (fields.title ?? '').trim(),
      description: fields.description ?? '',
      lessonId: (fields.lessonId ?? '').trim(),
      filename: file?.filename ?? '',
      mimeType: file?.mimeType ?? '',
      size: file?.size ?? 0,
      stream: file?.stream ?? null,
      extras: fields,
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      if (!fileFieldNames.includes(name)) {
        file.resume();
        return;
      }

      const mimeType = info.mimeType || 'application/octet-stream';
      const allowedByPrefix =
        options.allowedMimePrefixes?.some((prefix) => mimeType.startsWith(prefix)) ?? false;
      const allowedByType = options.allowedMimeTypes?.includes(mimeType) ?? false;
      if (
        (options.allowedMimePrefixes || options.allowedMimeTypes) &&
        !allowedByPrefix &&
        !allowedByType
      ) {
        file.resume();
        fail(new AppError(`Unsupported file type: ${mimeType}`, ERROR_CODES.INVALID_FILE, 400));
        return;
      }

      file.on('limit', () => {
        fail(
          new AppError(
            `File exceeds maximum size of ${options.maxSize} bytes`,
            ERROR_CODES.FILE_TOO_LARGE,
            413,
          ),
        );
      });

      const declaredSize = Number(fields.fileSize);
      const passthrough = new PassThrough();
      file.pipe(passthrough);
      file.on('error', fail);

      if (settled) {
        return;
      }
      settled = true;
      resolve(
        buildPayload({
          filename: info.filename,
          mimeType,
          stream: passthrough,
          size: Number.isFinite(declaredSize) && declaredSize > 0 ? declaredSize : 0,
        }),
      );
    });

    busboy.on('filesLimit', () => {
      fail(new AppError('Only one file can be uploaded', ERROR_CODES.VALIDATION_ERROR, 400));
    });

    busboy.on('error', fail);
    busboy.on('finish', () => {
      if (settled) {
        return;
      }
      if (requireFile) {
        fail(new AppError('File is required', ERROR_CODES.INVALID_FILE, 400));
        return;
      }
      settled = true;
      resolve(buildPayload(null));
    });

    req.pipe(busboy);
  });
}
