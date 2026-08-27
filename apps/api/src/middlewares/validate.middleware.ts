import type { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { AppError, ERROR_CODES } from '@video/shared';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new AppError(
          parsed.error.issues.map((issue) => issue.message).join(', '),
          ERROR_CODES.VALIDATION_ERROR,
          400,
          parsed.error.flatten(),
        ),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}
