import { z } from 'zod';

export const createMemberModuleSchema = z.object({
  userId: z.string().min(1),
  moduleId: z.string().min(1),
});

export const replaceMemberModulesSchema = z.object({
  userId: z.string().min(1),
  moduleIds: z.array(z.string().min(1)),
});
