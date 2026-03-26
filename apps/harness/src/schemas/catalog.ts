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

// POST /api/catalog/preview — GenericWorkoutRow shape (strict)
const GenericSlotRowSchema = z
  .object({
    slotId: z.string(),
    exerciseId: z.string(),
    exerciseName: z.string(),
    tier: z.string(),
    weight: z.number(),
    stage: z.number(),
    sets: z.number(),
    reps: z.number(),
    isAmrap: z.boolean(),
    stagesCount: z.number(),
    isChanged: z.boolean(),
    isDeload: z.boolean(),
    // optional fields
    result: z.string().optional(),
    amrapReps: z.number().optional(),
    rpe: z.number().optional(),
    repsMax: z.number().optional(),
    role: z.string().optional(),
    notes: z.string().optional(),
    prescriptions: z.array(z.unknown()).optional(),
    isGpp: z.boolean().optional(),
    complexReps: z.string().optional(),
    propagatesTo: z.string().optional(),
    isTestSlot: z.boolean().optional(),
    isBodyweight: z.boolean().optional(),
    setLogs: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const GenericWorkoutRowSchema = z
  .object({
    index: z.number(),
    dayName: z.string(),
    slots: z.array(GenericSlotRowSchema),
    isChanged: z.boolean(),
    completedAt: z.string().optional(),
  })
  .strict();

export const PreviewResponseSchema = z.array(GenericWorkoutRowSchema);
