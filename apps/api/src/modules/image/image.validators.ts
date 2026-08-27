import { z } from 'zod';

export const createImageSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  lessonId: z.string().min(1),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  duration: z.number().min(0).nullable().optional(),
});

export const updateImageSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    lessonId: z.string().min(1).optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    duration: z.number().min(0).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
