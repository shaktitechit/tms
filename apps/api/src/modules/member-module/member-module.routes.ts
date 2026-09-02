import { Router } from 'express';
import { requireAuth, requireTenantAdmin, requireTenantOrTutor, validateBody } from '../../middlewares/index.js';
import type { AppContext } from '../../types.js';
import { MemberModuleController } from './member-module.controller.js';
import {
  createMemberModuleSchema,
  replaceMemberModulesSchema,
} from './member-module.validators.js';

export function createMemberModuleRouter(ctx: AppContext): Router {
  const router = Router();
  const controller = new MemberModuleController();

  router.get('/', requireAuth(ctx), controller.list);
  router.post(
    '/',
    requireAuth(ctx),
    requireTenantAdmin,
    validateBody(createMemberModuleSchema),
    controller.create,
  );
  router.put(
    '/',
    requireAuth(ctx),
    requireTenantOrTutor,
    validateBody(replaceMemberModulesSchema),
    controller.replace,
  );
  router.get('/:id', requireAuth(ctx), controller.get);
  router.delete('/:id', requireAuth(ctx), requireTenantAdmin, controller.remove);

  return router;
}
