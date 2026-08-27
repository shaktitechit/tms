import { z } from 'zod';
import { MemberAccess, UserRole } from '@video/shared';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(80),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
  access: z.nativeEnum(MemberAccess).optional().default(MemberAccess.LEARNER),
  departmentIds: z.array(z.string().min(1)).optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    password: z.string().min(8).max(72).optional(),
    role: z.nativeEnum(UserRole).optional(),
    access: z.nativeEnum(MemberAccess).optional(),
    departmentIds: z.array(z.string().min(1)).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
