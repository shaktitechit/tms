import { Router } from 'express';
import { optionalAuth } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { VideoController } from './video.controller.js';
import { createTenantVideoRouter } from './video.tenant.routes.js';
import { createUserVideoRouter } from './video.user.routes.js';

/**
 * Video routes:
 * - `/tenant/*` — tenant admin: all videos in the tenant
 * - `/user/*` — member user: videos belonging to their tenant
 * - `/*` — public playback / catalog (visibility-gated)
 */
export function createVideoRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new VideoController(ctx);

  router.use('/tenant', createTenantVideoRouter(ctx));
  router.use('/user', createUserVideoRouter(ctx));

  router.get('/', optionalAuth(ctx), controller.listPublic);
  router.get('/:id/status', optionalAuth(ctx), controller.statusPublic);
  router.get('/:id/stream', optionalAuth(ctx), controller.stream);
  router.get('/:id/original', optionalAuth(ctx), controller.original);
  router.get('/:id/thumbnail', optionalAuth(ctx), controller.thumbnail);
  router.get('/:id/hls/*', optionalAuth(ctx), controller.hls);
  router.get('/:id', optionalAuth(ctx), controller.getPublic);

  return router;
}
