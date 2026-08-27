export const ERROR_CODES = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_FILE: 'INVALID_FILE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  VIDEO_NOT_READY: 'VIDEO_NOT_READY',
  VIDEO_PROCESSING_FAILED: 'VIDEO_PROCESSING_FAILED',
  VIDEO_UNAVAILABLE: 'VIDEO_UNAVAILABLE',
  INVALID_PATH: 'INVALID_PATH',
  STORAGE_ERROR: 'STORAGE_ERROR',
  QUEUE_ERROR: 'QUEUE_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const DEFAULT_ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
] as const;

export const DEFAULT_ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv'] as const;

export const DEFAULT_VIDEO_MAX_SIZE = 5 * 1024 * 1024 * 1024;

export const HLS_CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/MP2T',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};
