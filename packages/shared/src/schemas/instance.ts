import { z } from 'zod/v4';

const ResultValueSchema = z.enum(['success', 'fail']);

const SlotResultSchema = z.strictObject({
  result: ResultValueSchema.optional(),
  amrapReps: z.number().int().min(0).max(999).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
});

const GenericWorkoutResultSchema = z.record(z.string(), SlotResultSchema);

export const GenericResultsSchema = z.record(
  z.string().regex(/^\d{1,3}$/),
  GenericWorkoutResultSchema
);

const GenericUndoEntrySchema = z.strictObject({
  i: z.number().int().min(0),
  slotId: z.string().min(1),
  prev: ResultValueSchema.optional(),
  prevRpe: z.number().int().min(1).max(10).optional(),
  prevAmrapReps: z.number().int().min(0).optional(),
});

export const GenericUndoHistorySchema = z.array(GenericUndoEntrySchema);

const ProgramInstanceStatusSchema = z.enum(['active', 'completed', 'archived']);

export const ProgramInstanceSchema = z.strictObject({
  id: z.string().min(1),
  programId: z.string().min(1),
  name: z.string().min(1),
  config: z.record(z.string(), z.number()),
  results: GenericResultsSchema,
  undoHistory: GenericUndoHistorySchema,
  status: ProgramInstanceStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProgramInstanceMapSchema = z.strictObject({
  version: z.number().int().positive(),
  activeProgramId: z.string().nullable(),
  instances: z.record(z.string(), ProgramInstanceSchema),
});
