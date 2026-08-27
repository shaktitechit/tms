import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(''),
});

export const updateDepartmentSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
