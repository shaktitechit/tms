import { z } from 'zod';

export const createDiscussionSchema = z
  .object({
    videoId: z.string().min(1).optional(),
    lessonId: z.string().min(1).optional(),
    body: z.string().min(1).max(2000),
    parentId: z.string().min(1).optional(),
  })
  .refine((value) => (value.videoId ? 1 : 0) + (value.lessonId ? 1 : 0) === 1, {
    message: 'Provide exactly one of videoId or lessonId',
  });

export const updateDiscussionSchema = z.object({
  body: z.string().min(1).max(2000),
});
