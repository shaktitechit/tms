import { Router } from 'express';
import {
  requireAuth,
  requireTenantAdmin,
  requireTenantOrTutor,
  requireTutor,
  validateBody,
} from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { UserController } from './user.controller.js';
import { createUserSchema, updateUserSchema } from './user.validators.js';

export function createUserRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new UserController();

  router.get('/', requireAuth(ctx), controller.list);
  router.post(
    '/',
    requireAuth(ctx),
    requireTenantAdmin,
    validateBody(createUserSchema),
    controller.create,
  );
  /** Tutor-scoped: learners who share an assigned department with the caller. */
  router.get('/my-learners', requireAuth(ctx), requireTutor, controller.listMyLearners);
  router.post(
    '/my-learners',
    requireAuth(ctx),
    requireTenantOrTutor,
    validateBody(createUserSchema),
    controller.createLearner,
  );
  router.get('/:id/progress', requireAuth(ctx), controller.getProgress);
  router.get('/:id', requireAuth(ctx), controller.get);
  router.patch('/:id', requireAuth(ctx), validateBody(updateUserSchema), controller.update);
  router.delete('/:id', requireAuth(ctx), requireTenantAdmin, controller.remove);

  return router;
}
