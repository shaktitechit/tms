import type { NextFunction, Request, Response } from 'express';
import { toErrorBody } from '@video/shared';
import type { AppContext } from '../types.js';

export function errorHandler(ctx: AppContext) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const body = toErrorBody(err);
    const logPayload = {
      err,
      method: req.method,
      url: req.originalUrl,
      code: body.code,
    };

    if (body.statusCode >= 500) {
      ctx.logger.error(logPayload, 'Unhandled API error');
    } else {
      ctx.logger.warn(logPayload, body.message);
    }

    const payload: { success: false; message: string; code: string } = {
      success: false,
      message: body.message,
      code: body.code,
    };

    if (ctx.env.NODE_ENV !== 'production' && err instanceof Error && body.statusCode >= 500) {
      payload.message = err.message;
    }

    res.status(body.statusCode).json(payload);
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND',
  });
}
