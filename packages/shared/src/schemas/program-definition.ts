import { z } from 'zod/v4';

// --- Progression Rules (discriminated union) ---

const AddWeightRuleSchema = z.strictObject({
  type: z.literal('add_weight'),
});

const DeloadPercentRuleSchema = z.strictObject({
  type: z.literal('deload_percent'),
  percent: z.number().min(1).max(99),
});

const AdvanceStageRuleSchema = z.strictObject({
  type: z.literal('advance_stage'),
});

const AddWeightResetStageRuleSchema = z.strictObject({
  type: z.literal('add_weight_reset_stage'),
  amount: z.number().positive(),
});

const NoChangeRuleSchema = z.strictObject({
  type: z.literal('no_change'),
});

const AdvanceStageAddWeightRuleSchema = z.strictObject({
  type: z.literal('advance_stage_add_weight'),
});

export const ProgressionRuleSchema = z.discriminatedUnion('type', [
  AddWeightRuleSchema,
  DeloadPercentRuleSchema,
  AdvanceStageRuleSchema,
  AddWeightResetStageRuleSchema,
  NoChangeRuleSchema,
  AdvanceStageAddWeightRuleSchema,
]);

// --- Stage Definition ---

export const StageDefinitionSchema = z.strictObject({
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  amrap: z.boolean().optional(),
});

// --- Tier ---

export const TierSchema = z.enum(['t1', 't2', 't3']);

// --- Exercise Slot ---

export const ExerciseSlotSchema = z.strictObject({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  tier: TierSchema,
  stages: z.array(StageDefinitionSchema).min(1),
  onSuccess: ProgressionRuleSchema,
  onUndefined: ProgressionRuleSchema.optional(),
  onMidStageFail: ProgressionRuleSchema,
  onFinalStageFail: ProgressionRuleSchema,
  startWeightKey: z.string().min(1),
  startWeightMultiplier: z.number().positive().optional(),
  startWeightOffset: z.number().int().nonnegative().optional(),
});

// --- Program Day ---

export const ProgramDaySchema = z.strictObject({
  name: z.string().min(1),
  slots: z.array(ExerciseSlotSchema).min(1),
});

// --- Config Field ---

export const ConfigFieldSchema = z.strictObject({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.literal('weight'),
  min: z.number(),
  step: z.number().positive(),
});

// --- Program Definition ---

export const ProgramDefinitionSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  author: z.string(),
  version: z.number().int().positive(),
  category: z.string(),
  source: z.enum(['preset', 'custom']),
  days: z.array(ProgramDaySchema).min(1),
  cycleLength: z.number().int().positive(),
  totalWorkouts: z.number().int().positive(),
  workoutsPerWeek: z.number().int().positive(),
  exercises: z.record(z.string(), z.strictObject({ name: z.string().min(1) })),
  configFields: z.array(ConfigFieldSchema),
  weightIncrements: z.record(z.string(), z.number().positive()),
});
