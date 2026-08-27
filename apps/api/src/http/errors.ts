import { AppError, ERROR_CODES } from '@video/shared';

export { AppError };

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(message, ERROR_CODES.UNAUTHORIZED, 401);
}

export function forbidden(message = 'You do not have permission to perform this action'): AppError {
  return new AppError(message, ERROR_CODES.FORBIDDEN, 403);
}

export function notFound(message = 'Resource not found', code: string = ERROR_CODES.NOT_FOUND): AppError {
  return new AppError(message, code, 404);
}

export function badRequest(message = 'Bad request', code: string = ERROR_CODES.VALIDATION_ERROR): AppError {
  return new AppError(message, code, 400);
}
