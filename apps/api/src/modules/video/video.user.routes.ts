import { Router } from 'express';
import { UserRole } from '@video/shared';
import {
  requireAuth,
  requireRole,
  requireTutor,
  uploadRateLimiter,
  validateBody,
} from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { VideoController } from './video.controller.js';
import { createYoutubeVideoSchema, updateVideoSchema } from './video.validators.js';

const requireMember = requireRole(UserRole.USER);

/** Member video API. Tutors may upload; learners are read/update-own. */
export function createUserVideoRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new VideoController(ctx);
  const guard = [requireAuth(ctx), requireMember] as const;

  router.get('/', ...guard, controller.listUser);
  router.post(
    '/youtube',
    requireAuth(ctx),
    requireTutor,
    uploadRateLimiter(ctx),
    validateBody(createYoutubeVideoSchema),
    controller.uploadYoutube,
  );
  router.post('/', requireAuth(ctx), requireTutor, uploadRateLimiter(ctx), controller.upload);
  router.get('/:id/status', ...guard, controller.statusUser);
  router.post('/:id/seen', ...guard, controller.markSeenUser);
  router.get('/:id', ...guard, controller.getUser);
  router.patch('/:id', ...guard, validateBody(updateVideoSchema), controller.updateUser);
  router.delete('/:id', ...guard, controller.removeUser);

  return router;
}
