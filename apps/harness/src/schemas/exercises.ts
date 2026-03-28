// http-contract.md §8 — Exercise response shapes
// Verified against services/exercises.ts ExerciseEntry interface and toExerciseEntry()
// Actual shape: {id, name, muscleGroupId, equipment, isCompound, isPreset, createdBy, force, level, mechanic, category, secondaryMuscles}
import { z } from 'zod/v4';

const ExerciseEntrySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    muscleGroupId: z.string(),
    equipment: z.string().nullable(),
    isCompound: z.boolean(),
    isPreset: z.boolean(),
    createdBy: z.string().nullable(),
    force: z.string().nullable(),
    level: z.string().nullable(),
    mechanic: z.string().nullable(),
    category: z.string().nullable(),
    secondaryMuscles: z.array(z.string()).nullable(),
  })
  .strict();

// GET /api/exercises returns {data, total, offset, limit}
export const ExerciseListResponseSchema = z
  .object({
    data: z.array(ExerciseEntrySchema),
    total: z.number(),
    offset: z.number(),
    limit: z.number(),
  })
  .strict();

// GET /api/muscle-groups returns [{id, name}]
export const MuscleGroupsResponseSchema = z.array(
  z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .strict()
);

// POST /api/exercises returns a single ExerciseEntry
export const CreateExerciseResponseSchema = ExerciseEntrySchema;

export { ExerciseEntrySchema };
