import { Router } from 'express';
import { requireAuth, validateBody } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { DiscussionController } from './discussion.controller.js';
import { createDiscussionSchema, updateDiscussionSchema } from './discussion.validators.js';

export function createDiscussionRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new DiscussionController(ctx);

  router.get('/', requireAuth(ctx), controller.list);
  router.post('/', requireAuth(ctx), validateBody(createDiscussionSchema), controller.create);
  router.get('/:id', requireAuth(ctx), controller.get);
  router.patch('/:id', requireAuth(ctx), validateBody(updateDiscussionSchema), controller.update);
  router.delete('/:id', requireAuth(ctx), controller.remove);

  return router;
}
