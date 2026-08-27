import { z } from 'zod';

export const createModuleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(''),
  authorName: z.string().min(1).max(120),
  authorEmail: z.string().email().max(200),
  departmentId: z.string().min(1).nullable().optional(),
});

export const updateModuleSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    authorName: z.string().min(1).max(120).optional(),
    authorEmail: z.string().email().max(200).optional(),
    departmentId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
