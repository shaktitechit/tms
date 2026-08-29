import { z } from 'zod';

export const createLiveSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scheduledStartTime: z.string().datetime(),
  invitedUserIds: z.array(z.string()).optional(),
});

export const updateLiveSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['upcoming', 'live', 'ended']).optional(),
  scheduledStartTime: z.string().datetime().optional(),
  invitedUserIds: z.array(z.string()).optional(),
});

export const createChatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
});
