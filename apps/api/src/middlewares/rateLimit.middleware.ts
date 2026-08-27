import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@video/shared';
import type { AppContext } from '../types.js';

function jsonLimitHandler(): RequestHandler {
  return (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests',
      code: ERROR_CODES.RATE_LIMITED,
    });
  };
}

export function generalRateLimiter(ctx: AppContext) {
  return rateLimit({
    windowMs: ctx.env.RATE_LIMIT_WINDOW_MS,
    max: ctx.env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonLimitHandler(),
  });
}

export function authRateLimiter(ctx: AppContext) {
  return rateLimit({
    windowMs: ctx.env.RATE_LIMIT_WINDOW_MS,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonLimitHandler(),
  });
}

export function uploadRateLimiter(ctx: AppContext) {
  return rateLimit({
    windowMs: ctx.env.RATE_LIMIT_WINDOW_MS,
    max: ctx.env.UPLOAD_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonLimitHandler(),
  });
}
