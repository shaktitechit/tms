import { Router } from 'express';
import { requireAuth, requireTenantOrTutor } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { LessonController } from './lesson.controller.js';

export function createLessonRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new LessonController(ctx);

  router.get('/', requireAuth(ctx), controller.list);
  router.post('/', requireAuth(ctx), requireTenantOrTutor, controller.create);
  router.put('/order', requireAuth(ctx), requireTenantOrTutor, controller.reorder);
  router.get('/:id/thumbnail', requireAuth(ctx), controller.thumbnail);
  router.put('/:id/content-order', requireAuth(ctx), requireTenantOrTutor, controller.reorderContent);
  router.get('/:id', requireAuth(ctx), controller.get);
  router.patch('/:id', requireAuth(ctx), requireTenantOrTutor, controller.update);
  router.delete('/:id', requireAuth(ctx), requireTenantOrTutor, controller.remove);

  return router;
}
