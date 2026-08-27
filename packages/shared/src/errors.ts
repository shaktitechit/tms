import { ERROR_CODES, type ErrorCode } from './constants.js';

export class AppError extends Error {
  readonly code: ErrorCode | string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: ErrorCode | string = ERROR_CODES.INTERNAL_ERROR,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class UnrecoverableProcessingError extends Error {
  readonly code = ERROR_CODES.VIDEO_PROCESSING_FAILED;
  readonly stderr?: string;

  constructor(message: string, stderr?: string) {
    super(message);
    this.name = 'UnrecoverableProcessingError';
    this.stderr = stderr;
  }
}

export function toErrorBody(error: unknown): {
  success: false;
  message: string;
  code: string;
  statusCode: number;
} {
  if (error instanceof AppError) {
    return {
      success: false,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  return {
    success: false,
    message: 'Internal server error',
    code: ERROR_CODES.INTERNAL_ERROR,
    statusCode: 500,
  };
}
