import { z } from 'zod';

export const createLessonSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(''),
  authorName: z.string().min(1).max(120),
  authorEmail: z.string().email().max(200),
  moduleId: z.string().min(1),
});

export const updateLessonSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    authorName: z.string().min(1).max(120).optional(),
    authorEmail: z.string().email().max(200).optional(),
    moduleId: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const reorderLessonsSchema = z.object({
  moduleId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1),
});

export const reorderLessonContentSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(['text', 'video', 'audio', 'image', 'quiz', 'pdf']),
        id: z.string().min(1),
      }),
    )
    .default([]),
});
