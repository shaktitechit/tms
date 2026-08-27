import { Router } from 'express';
import { requireAuth, requireTenantAdmin, requireTenantOrTutor } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { ModuleController } from './module.controller.js';

export function createModuleRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new ModuleController(ctx);

  router.get('/', requireAuth(ctx), controller.list);
  router.post('/', requireAuth(ctx), controller.create);
  router.get('/:id/thumbnail', requireAuth(ctx), controller.thumbnail);
  router.get('/:id', requireAuth(ctx), controller.get);
  router.patch('/:id', requireAuth(ctx), requireTenantOrTutor, controller.update);
  router.delete('/:id', requireAuth(ctx), requireTenantAdmin, controller.remove);

  return router;
}
