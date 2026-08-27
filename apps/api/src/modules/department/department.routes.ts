import { Router } from 'express';
import { requireAuth, requireTenantAdmin } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { DepartmentController } from './department.controller.js';

export function createDepartmentRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new DepartmentController(ctx);

  router.get('/', requireAuth(ctx), controller.list);
  router.post('/', requireAuth(ctx), requireTenantAdmin, controller.create);
  router.get('/:id/thumbnail', requireAuth(ctx), controller.thumbnail);
  router.get('/:id', requireAuth(ctx), controller.get);
  router.patch('/:id', requireAuth(ctx), requireTenantAdmin, controller.update);
  router.delete('/:id', requireAuth(ctx), requireTenantAdmin, controller.remove);

  return router;
}
