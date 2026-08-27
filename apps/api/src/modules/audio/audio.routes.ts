import { Router } from 'express';
import { requireAuth, requireTenantOrTutor } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { AudioController } from './audio.controller.js';

export function createAudioRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new AudioController(ctx);

  router.get('/', requireAuth(ctx), controller.list);
  router.post('/', requireAuth(ctx), requireTenantOrTutor, controller.create);
  router.get('/:id/status', requireAuth(ctx), controller.status);
  router.get('/:id/stream', requireAuth(ctx), controller.stream);
  router.get('/:id/file', requireAuth(ctx), controller.file);
  router.get('/:id/hls/*', requireAuth(ctx), controller.hls);
  router.get('/:id', requireAuth(ctx), controller.get);
  router.patch('/:id', requireAuth(ctx), requireTenantOrTutor, controller.update);
  router.delete('/:id', requireAuth(ctx), requireTenantOrTutor, controller.remove);
  router.post('/:id/seen', requireAuth(ctx), controller.markSeen);

  return router;
}
