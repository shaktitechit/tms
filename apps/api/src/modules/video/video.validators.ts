import { z } from 'zod';
import { VideoVisibility } from '@video/shared';

export const updateVideoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  visibility: z.nativeEnum(VideoVisibility).optional(),
  moduleId: z.string().min(1).nullable().optional(),
  lessonId: z.string().min(1).nullable().optional(),
});
