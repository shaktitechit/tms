import {
  DEFAULT_ALLOWED_EXTENSIONS,
  DEFAULT_ALLOWED_MIME_TYPES,
  DEFAULT_VIDEO_MAX_SIZE,
  ERROR_CODES,
} from './constants.js';
import { getExtension } from './storage-keys.js';

export interface FileValidationInput {
  filename: string;
  mimeType: string;
  size?: number;
}

export interface FileValidationOptions {
  allowedMimeTypes?: readonly string[];
  allowedExtensions?: readonly string[];
  maxSize?: number;
}

export interface FileValidationResult {
  ok: boolean;
  code?: string;
  message?: string;
  extension?: string;
}

export function validateVideoFile(
  input: FileValidationInput,
  options: FileValidationOptions = {},
): FileValidationResult {
  const allowedMimeTypes = options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
  const allowedExtensions = options.allowedExtensions ?? DEFAULT_ALLOWED_EXTENSIONS;
  const maxSize = options.maxSize ?? DEFAULT_VIDEO_MAX_SIZE;

  const extension = getExtension(input.filename);
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      ok: false,
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      message: `Unsupported file extension. Allowed: ${allowedExtensions.join(', ')}`,
    };
  }

  const mime = input.mimeType.toLowerCase();
  if (!allowedMimeTypes.includes(mime)) {
    return {
      ok: false,
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      message: `Unsupported MIME type: ${input.mimeType}`,
    };
  }

  if (typeof input.size === 'number' && input.size > maxSize) {
    return {
      ok: false,
      code: ERROR_CODES.FILE_TOO_LARGE,
      message: `File exceeds maximum size of ${maxSize} bytes`,
    };
  }

  if (typeof input.size === 'number' && input.size <= 0) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_FILE,
      message: 'File is empty',
    };
  }

  return { ok: true, extension };
}
