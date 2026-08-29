import { Router } from 'express';
import { requireAuth, requireTenantOrTutor, validateBody } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { liveSessionController } from './live-session.controller.js';
import {
  createLiveSessionSchema,
  updateLiveSessionSchema,
  createChatMessageSchema,
} from './live-session.validators.js';

export function createLiveSessionRouter(ctx: AppContext): Router {
  const router = Router();

  // Session routes
  router.get('/', requireAuth(ctx), liveSessionController.list);
  router.post(
    '/',
    requireAuth(ctx),
    requireTenantOrTutor,
    validateBody(createLiveSessionSchema),
    liveSessionController.create
  );
  router.get('/:id', requireAuth(ctx), liveSessionController.get);
  router.patch(
    '/:id',
    requireAuth(ctx),
    requireTenantOrTutor,
    validateBody(updateLiveSessionSchema),
    liveSessionController.update
  );
  router.delete(
    '/:id',
    requireAuth(ctx),
    requireTenantOrTutor,
    liveSessionController.delete
  );

  // Live Discussion Chat routes
  router.get('/:id/chat', requireAuth(ctx), liveSessionController.getChatHistory);
  router.post(
    '/:id/chat',
    requireAuth(ctx),
    validateBody(createChatMessageSchema),
    liveSessionController.postChatMessage
  );
  router.get('/:id/chat/stream', requireAuth(ctx), liveSessionController.chatStream);

  return router;
}
