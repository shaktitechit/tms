import { describe, expect, it, vi } from 'vitest';
import { S3CompatibleStorage } from './server/storage.js';
import type { AppEnv, Logger } from './server/index.js';

const env = {
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: 9000,
  MINIO_ACCESS_KEY: 'minioadmin',
  MINIO_SECRET_KEY: 'minioadmin',
  MINIO_BUCKET: 'contents',
  MINIO_USE_SSL: false,
  MINIO_REGION: 'us-east-1',
  MINIO_PUBLIC_URL: 'http://localhost:9000',
} as Pick<
  AppEnv,
  | 'MINIO_ENDPOINT'
  | 'MINIO_PORT'
  | 'MINIO_ACCESS_KEY'
  | 'MINIO_SECRET_KEY'
  | 'MINIO_BUCKET'
  | 'MINIO_USE_SSL'
  | 'MINIO_REGION'
  | 'MINIO_PUBLIC_URL'
>;

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as Logger;

describe('S3CompatibleStorage', () => {
  it('builds path-style public URLs from the configured endpoint', () => {
    const storage = new S3CompatibleStorage(env, logger);
    expect(storage.getPublicUrl('videos/abc/hls/master.m3u8')).toBe(
      'http://localhost:9000/contents/videos/abc/hls/master.m3u8',
    );
    expect('MINIO_SECRET_KEY' in storage).toBe(false);
  });
});
