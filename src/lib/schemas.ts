import { z } from 'zod/v4';

export const StartWeightsSchema = z.strictObject({
  squat: z.number().min(2.5),
  bench: z.number().min(2.5),
  deadlift: z.number().min(2.5),
  ohp: z.number().min(2.5),
  latpulldown: z.number().min(2.5),
  dbrow: z.number().min(2.5),
});

const ResultValue = z.enum(['success', 'fail']);

const WorkoutResultSchema = z.strictObject({
  t1: ResultValue.optional(),
  t2: ResultValue.optional(),
  t3: ResultValue.optional(),
  t1Reps: z.number().int().min(0).max(999).optional(),
  t3Reps: z.number().int().min(0).max(999).optional(),
});

export const ResultsSchema = z.record(z.string().regex(/^\d{1,2}$/), WorkoutResultSchema);

const TierValue = z.enum(['t1', 't2', 't3']);

const UndoEntrySchema = z.strictObject({
  i: z.number(),
  tier: TierValue,
  prev: ResultValue.optional(),
});

export const UndoHistorySchema = z.array(UndoEntrySchema);

export const ExportDataSchema = z.strictObject({
  version: z.number(),
  exportDate: z.string(),
  results: ResultsSchema,
  startWeights: StartWeightsSchema,
  undoHistory: UndoHistorySchema,
});
