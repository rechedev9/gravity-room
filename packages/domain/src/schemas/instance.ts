import { z } from 'zod/v4';

const ResultValueSchema = z.enum(['success', 'fail']);

export const SetLogEntrySchema = z.strictObject({
  reps: z.number().int().min(0).max(999),
  weight: z.number().nonnegative().optional(),
  rpe: z.number().int().min(1).max(10).optional(),
});

const SlotResultSchema = z.strictObject({
  result: ResultValueSchema.optional(),
  amrapReps: z.number().int().min(0).max(999).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  setLogs: z.array(SetLogEntrySchema).optional(),
});

const GenericWorkoutResultSchema = z.record(z.string(), SlotResultSchema);

export const GenericResultsSchema = z.record(
  z.string().regex(/^\d{1,3}$/),
  GenericWorkoutResultSchema
);

export type GenericResults = z.infer<typeof GenericResultsSchema>;

const GenericUndoEntrySchema = z.strictObject({
  i: z.number().int().min(0),
  slotId: z.string().min(1),
  prev: ResultValueSchema.optional(),
  prevRpe: z.number().int().min(1).max(10).optional(),
  prevAmrapReps: z.number().int().min(0).optional(),
  prevSetLogs: z.array(SetLogEntrySchema).optional(),
});

export const GenericUndoHistorySchema = z.array(GenericUndoEntrySchema);

export type GenericUndoHistory = z.infer<typeof GenericUndoHistorySchema>;

const ProgramInstanceStatusSchema = z.enum(['active', 'completed', 'archived']);

export const ProgramInstanceSchema = z.strictObject({
  id: z.string().min(1),
  programId: z.string().min(1),
  name: z.string().min(1),
  config: z.record(z.string(), z.union([z.number(), z.string()])),
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

export type ProgramInstance = z.infer<typeof ProgramInstanceSchema>;
export type ProgramInstanceMap = z.infer<typeof ProgramInstanceMapSchema>;

export const GenericProgramDetailSchema = z.object({
  id: z.string(),
  programId: z.string(),
  name: z.string(),
  config: z.record(z.string(), z.union([z.number(), z.string()])).catch({}),
  metadata: z.unknown(),
  results: GenericResultsSchema.catch({}),
  undoHistory: GenericUndoHistorySchema.catch([]),
  resultTimestamps: z.record(z.string(), z.string()).catch({}),
  completedDates: z.record(z.string(), z.string()).catch({}),
  definitionId: z.string().nullable().catch(null),
  customDefinition: z.unknown(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GenericProgramDetail = z.infer<typeof GenericProgramDetailSchema>;
