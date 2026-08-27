import { z } from 'zod';

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(120),
});
