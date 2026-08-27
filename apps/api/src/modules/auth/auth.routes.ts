import { Router } from 'express';
import {
  authRateLimiter,
  optionalAuth,
  requireAuth,
  validateBody,
} from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { AuthController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.validators.js';

export function createAuthRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new AuthController(ctx);
  const limiter = authRateLimiter(ctx);

  router.post('/register', limiter, validateBody(registerSchema), controller.register);
  router.post('/login', limiter, validateBody(loginSchema), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', optionalAuth(ctx), requireAuth(ctx), controller.me);

  return router;
}
