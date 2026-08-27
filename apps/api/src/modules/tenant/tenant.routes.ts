import { Router } from 'express';
import { requireAuth, requireTenantAdmin } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { TenantController } from './tenant.controller.js';

export function createTenantRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new TenantController(ctx);

  router.get('/me', requireAuth(ctx), controller.me);
  router.get('/me/logo', requireAuth(ctx), controller.logo);
  router.patch('/me', requireAuth(ctx), requireTenantAdmin, controller.updateMe);

  return router;
}
