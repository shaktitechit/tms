import { z } from 'zod';

export const createTextAreaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional().default(''),
  body: z.string().max(100_000),
  duration: z.number().min(0).nullable().optional(),
  lessonId: z.string().min(1),
});

export const updateTextAreaSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    body: z.string().max(100_000).optional(),
    duration: z.number().min(0).nullable().optional(),
    lessonId: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
