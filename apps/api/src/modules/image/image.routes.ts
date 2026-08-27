import { Router } from 'express';
import { requireAuth, requireTenantOrTutor } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { ImageController } from './image.controller.js';

export function createImageRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new ImageController(ctx);

  router.get('/', requireAuth(ctx), controller.list);
  router.post('/', requireAuth(ctx), requireTenantOrTutor, controller.create);
  router.get('/:id/file', requireAuth(ctx), controller.file);
  router.get('/:id', requireAuth(ctx), controller.get);
  router.patch('/:id', requireAuth(ctx), requireTenantOrTutor, controller.update);
  router.delete('/:id', requireAuth(ctx), requireTenantOrTutor, controller.remove);
  router.post('/:id/seen', requireAuth(ctx), controller.markSeen);

  return router;
}
