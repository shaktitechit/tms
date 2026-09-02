import { Router } from 'express';
import {
  requireAuth,
  requireTenantAdmin,
  uploadRateLimiter,
  validateBody,
} from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { VideoController } from './video.controller.js';
import { createYoutubeVideoSchema, updateVideoSchema } from './video.validators.js';

/** Tenant-admin video API: all videos belonging to the caller's tenant. */
export function createTenantVideoRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new VideoController(ctx);
  const guard = [requireAuth(ctx), requireTenantAdmin] as const;

  router.get('/', ...guard, controller.listTenant);
  router.post(
    '/youtube',
    ...guard,
    uploadRateLimiter(ctx),
    validateBody(createYoutubeVideoSchema),
    controller.uploadYoutube,
  );
  router.post('/', ...guard, uploadRateLimiter(ctx), controller.upload);
  router.get('/:id/status', ...guard, controller.statusTenant);
  router.post('/:id/seen', ...guard, controller.markSeenTenant);
  router.get('/:id', ...guard, controller.getTenant);
  router.patch('/:id', ...guard, validateBody(updateVideoSchema), controller.updateTenant);
  router.delete('/:id', ...guard, controller.removeTenant);

  return router;
}
