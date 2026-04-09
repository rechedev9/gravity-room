import { z } from 'zod/v4';
import { PROGRAM_LEVELS } from '@gzclp/shared/catalog';

export const CatalogEntrySchema = z.object({
  id: z.string().catch(''),
  name: z.string().catch(''),
  description: z.string().catch(''),
  author: z.string().catch(''),
  category: z.string().catch(''),
  level: z.enum(PROGRAM_LEVELS).catch('intermediate'),
  source: z.string().catch(''),
  totalWorkouts: z.number().int().catch(0),
  workoutsPerWeek: z.number().int().catch(0),
  cycleLength: z.number().int().catch(0),
});

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
