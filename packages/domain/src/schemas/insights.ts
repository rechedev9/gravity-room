import { z } from 'zod/v4';

export const InsightItemSchema = z.object({
  insightType: z.string().catch(''),
  exerciseId: z.string().nullable().catch(null),
  payload: z.unknown(),
  computedAt: z.string().catch(''),
  validUntil: z.string().nullable().catch(null),
});

export type InsightItem = z.infer<typeof InsightItemSchema>;
