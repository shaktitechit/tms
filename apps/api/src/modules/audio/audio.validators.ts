import { z } from 'zod';

export const createAudioSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  lessonId: z.string().min(1).optional(),
  duration: z.number().positive().optional(),
});

export const updateAudioSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    lessonId: z.string().min(1).nullable().optional(),
    duration: z.number().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
