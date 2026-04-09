import { z } from 'zod/v4';

function processSecondaryMuscles(val: unknown): readonly string[] | null {
  if (!Array.isArray(val)) return null;
  // Array.isArray narrows val to any[] — no cast needed
  const strings = val.filter((x): x is string => typeof x === 'string');
  return strings.length > 0 ? strings : null;
}

export const ExerciseEntrySchema = z.object({
  id: z.string().catch(''),
  name: z.string().catch(''),
  muscleGroupId: z.string().catch(''),
  equipment: z.string().nullable().catch(null),
  isCompound: z.boolean().catch(false),
  isPreset: z.boolean().catch(false),
  createdBy: z.string().nullable().catch(null),
  force: z.string().nullable().catch(null),
  level: z.string().nullable().catch(null),
  mechanic: z.string().nullable().catch(null),
  category: z.string().nullable().catch(null),
  secondaryMuscles: z.unknown().transform(processSecondaryMuscles),
});

export type ExerciseEntry = z.infer<typeof ExerciseEntrySchema>;

export const MuscleGroupEntrySchema = z.object({
  id: z.string().catch(''),
  name: z.string().catch(''),
});

export type MuscleGroupEntry = z.infer<typeof MuscleGroupEntrySchema>;

export const PaginatedExercisesResponseSchema = z.object({
  data: z.array(z.unknown()),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
});

export type PaginatedExercisesResponse = {
  readonly data: readonly ExerciseEntry[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
};
