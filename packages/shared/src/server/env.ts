import { z } from 'zod';

const optionalString = z.string().optional().default('');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  MONGO_URI: z.string().min(1),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: optionalString,
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),
  MINIO_USE_SSL: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === 'true')
    .default(false),
  MINIO_REGION: z.string().default('us-east-1'),
  MINIO_PUBLIC_URL: z.string().optional().default(''),
  VIDEO_MAX_SIZE: z.coerce.number().default(5 * 1024 * 1024 * 1024),
  ALLOWED_VIDEO_MIME_TYPES: z.string().default('video/mp4,video/webm,video/quicktime,video/x-matroska'),
  ALLOWED_VIDEO_EXTENSIONS: z.string().default('.mp4,.webm,.mov,.mkv'),
  HLS_SEGMENT_DURATION: z.coerce.number().default(6),
  FFMPEG_PRESET: z.string().default('medium'),
  FFMPEG_CRF: z.coerce.number().default(23),
  WORKER_CONCURRENCY: z.coerce.number().default(1),
  WORKER_TEMP_DIR: z.string().default('/tmp/video-processing'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('video_session'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().default(10),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides: Record<string, unknown> = {}): AppEnv {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }
  return parsed.data;
}

export function csvList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
