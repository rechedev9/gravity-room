// http-contract.md §8 — Catalog response shapes
// Verified against services/catalog.ts CatalogEntry interface and toCatalogEntry()
// Actual shape: {id, name, description, author, category, level, source, totalWorkouts, workoutsPerWeek, cycleLength}
import { z } from 'zod';

const CatalogEntrySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    author: z.string(),
    category: z.string(),
    level: z.string(),
    source: z.string(),
    totalWorkouts: z.number(),
    workoutsPerWeek: z.number(),
    cycleLength: z.number(),
  })
  .strict();

// GET /api/catalog returns a bare array
export const CatalogListResponseSchema = z.array(CatalogEntrySchema);

// GET /api/catalog/:programId returns a hydrated ProgramDefinition (opaque)
// Use z.unknown() — structural validation of ProgramDefinition internals is out of scope
export const CatalogDetailResponseSchema = z.unknown();

export { CatalogEntrySchema };
