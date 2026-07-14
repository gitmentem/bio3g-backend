import { z } from 'zod';

export const faceTemplatesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type TFaceTemplatesQuery = z.infer<typeof faceTemplatesQuerySchema>;
