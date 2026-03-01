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

const UpdateTmRuleSchema = z.strictObject({
  type: z.literal('update_tm'),
  amount: z.number(),
  minAmrapReps: z.number().int().nonnegative(),
});

export const ProgressionRuleSchema = z.discriminatedUnion('type', [
  AddWeightRuleSchema,
  DeloadPercentRuleSchema,
  AdvanceStageRuleSchema,
  AddWeightResetStageRuleSchema,
  NoChangeRuleSchema,
  AdvanceStageAddWeightRuleSchema,
  UpdateTmRuleSchema,
]);

// --- Stage Definition ---

export const StageDefinitionSchema = z.strictObject({
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  amrap: z.boolean().optional(),
  repsMax: z.number().int().positive().optional(),
});

// --- Tier ---

export const TierSchema = z.string().min(1);

// --- Role ---

const RoleSchema = z.enum(['primary', 'secondary', 'accessory']);

// --- Set Prescription (percentage-based loading) ---

/** A single set prescription within a percentage-based exercise slot. */
export const SetPrescriptionSchema = z.strictObject({
  /** Percentage of 1RM (0-120). 0 is valid for GPP/bodyweight. */
  percent: z.number().min(0).max(120),
  /** Reps per set. */
  reps: z.number().int().positive(),
  /** Number of sets at this percentage. */
  sets: z.number().int().positive(),
});

// --- Exercise Slot ---

export const ExerciseSlotSchema = z.strictObject({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  tier: TierSchema,
  stages: z.array(StageDefinitionSchema).min(1),
  onSuccess: ProgressionRuleSchema,
  onFinalStageSuccess: ProgressionRuleSchema.optional(),
  onUndefined: ProgressionRuleSchema.optional(),
  onMidStageFail: ProgressionRuleSchema,
  onFinalStageFail: ProgressionRuleSchema,
  startWeightKey: z.string().min(1),
  startWeightMultiplier: z.number().positive().optional(),
  startWeightOffset: z.number().int().optional(),
  trainingMaxKey: z.string().min(1).optional(),
  tmPercent: z.number().positive().max(1).optional(),
  role: RoleSchema.optional(),
  notes: z.string().min(1).optional(),
  /** Percentage-based set prescriptions (replaces stages for %1RM programs). */
  prescriptions: z.array(SetPrescriptionSchema).min(1).optional(),
  /** Config key for the 1RM to derive weights from (e.g., 'squat1rm'). */
  percentOf: z.string().min(1).optional(),
  /** True for GPP slots where the athlete picks their own weight. */
  isGpp: z.boolean().optional(),
  /** Complex rep scheme display string (e.g., '1+3'). */
  complexReps: z.string().min(1).optional(),
});

// --- Program Day ---

export const ProgramDaySchema = z.strictObject({
  name: z.string().min(1),
  slots: z.array(ExerciseSlotSchema).min(1),
});

// --- Config Field (discriminated union) ---

const WeightConfigFieldSchema = z.strictObject({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.literal('weight'),
  min: z.number(),
  step: z.number().positive(),
  group: z.string().min(1).optional(),
  hint: z.string().min(1).optional(),
});

const SelectOptionSchema = z.strictObject({
  label: z.string().min(1),
  value: z.string().min(1),
});

const SelectConfigFieldSchema = z.strictObject({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.literal('select'),
  options: z.array(SelectOptionSchema).min(1),
  group: z.string().min(1).optional(),
});

export const ConfigFieldSchema = z.discriminatedUnion('type', [
  WeightConfigFieldSchema,
  SelectConfigFieldSchema,
]);

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
  weightIncrements: z.record(z.string(), z.number().nonnegative()),
  configTitle: z.string().min(1).optional(),
  configDescription: z.string().min(1).optional(),
  configEditTitle: z.string().min(1).optional(),
  configEditDescription: z.string().min(1).optional(),
  displayMode: z.enum(['flat', 'blocks']).optional(),
});
