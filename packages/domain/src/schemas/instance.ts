import { z } from 'zod/v4';
import { MAX_TOTAL_WORKOUTS } from './program-definition';

export const MAX_REPS = 999;

const ResultValueSchema = z.enum(['success', 'fail']);

export const SetLogEntrySchema = z.strictObject({
  reps: z.number().int().min(0).max(MAX_REPS),
  weight: z.number().nonnegative().optional(),
  rpe: z.number().int().min(1).max(10).optional(),
});

const SlotResultSchema = z.strictObject({
  result: ResultValueSchema.optional(),
  amrapReps: z.number().int().min(0).max(MAX_REPS).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  setLogs: z.array(SetLogEntrySchema).optional(),
});

const GenericWorkoutResultSchema = z.record(z.string(), SlotResultSchema);

export const WorkoutIndexKeySchema = z
  .string()
  .regex(/^\d+$/)
  .max(String(MAX_TOTAL_WORKOUTS - 1).length)
  .refine((key) => Number(key) < MAX_TOTAL_WORKOUTS, 'Workout index exceeds program limit');

export const GenericResultsSchema = z.record(WorkoutIndexKeySchema, GenericWorkoutResultSchema);

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

// Upper bound on program-config keys. Config is keyed by program config-field
// keys (largest real preset has 30); 100 leaves headroom while preventing a
// jsonb cell from being inflated with thousands of junk keys.
export const MAX_PROGRAM_CONFIG_KEYS = 100;

export const ProgramConfigSchema = z
  .record(z.string(), z.union([z.number(), z.string()]))
  .refine((cfg) => Object.keys(cfg).length <= MAX_PROGRAM_CONFIG_KEYS, {
    message: `config must have at most ${MAX_PROGRAM_CONFIG_KEYS} keys`,
  });

export const ProgramInstanceSchema = z.strictObject({
  id: z.string().min(1),
  programId: z.string().min(1),
  name: z.string().min(1),
  config: ProgramConfigSchema,
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

/** Local writes must reject malformed data; hydration fallbacks would silently erase it. */
export const GenericProgramDetailWriteSchema = GenericProgramDetailSchema.extend({
  config: GenericProgramDetailSchema.shape.config.unwrap(),
  results: GenericResultsSchema,
  undoHistory: GenericUndoHistorySchema,
  resultTimestamps: GenericProgramDetailSchema.shape.resultTimestamps.unwrap(),
  completedDates: GenericProgramDetailSchema.shape.completedDates.unwrap(),
  definitionId: GenericProgramDetailSchema.shape.definitionId.unwrap(),
});
