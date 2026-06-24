import { z } from 'zod/v4';

export const MAX_PROGRAM_STRING_LENGTH = 1000;

const ProgramStringSchema = z.string().max(MAX_PROGRAM_STRING_LENGTH);
const RequiredProgramStringSchema = ProgramStringSchema.min(1);

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

const DoubleProgressionRuleSchema = z
  .strictObject({
    type: z.literal('double_progression'),
    repRangeTop: z.number().int().positive(),
    repRangeBottom: z.number().int().positive(),
  })
  .refine((rule) => rule.repRangeBottom <= rule.repRangeTop, {
    message: 'repRangeBottom must be <= repRangeTop',
  });

export const ProgressionRuleSchema = z.discriminatedUnion('type', [
  AddWeightRuleSchema,
  DeloadPercentRuleSchema,
  AdvanceStageRuleSchema,
  AddWeightResetStageRuleSchema,
  NoChangeRuleSchema,
  AdvanceStageAddWeightRuleSchema,
  UpdateTmRuleSchema,
  DoubleProgressionRuleSchema,
]);

export const StageDefinitionSchema = z.strictObject({
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  amrap: z.boolean().optional(),
  repsMax: z.number().int().positive().optional(),
});

export const TierSchema = RequiredProgramStringSchema;

const RoleSchema = z.enum(['primary', 'secondary', 'accessory']);

export const SetPrescriptionSchema = z.strictObject({
  percent: z.number().min(0).max(120),
  reps: z.number().int().positive(),
  sets: z.number().int().positive(),
});

export const MAX_STAGES_PER_SLOT = 100;
export const MAX_PRESCRIPTIONS_PER_SLOT = 100;

export const ExerciseSlotSchema = z
  .strictObject({
    id: RequiredProgramStringSchema,
    exerciseId: RequiredProgramStringSchema,
    tier: TierSchema,
    stages: z.array(StageDefinitionSchema).min(1).max(MAX_STAGES_PER_SLOT),
    onSuccess: ProgressionRuleSchema,
    onFinalStageSuccess: ProgressionRuleSchema.optional(),
    onUndefined: ProgressionRuleSchema.optional(),
    onMidStageFail: ProgressionRuleSchema,
    onFinalStageFail: ProgressionRuleSchema,
    startWeightKey: RequiredProgramStringSchema,
    startWeightMultiplier: z.number().positive().optional(),
    startWeightOffset: z.number().int().optional(),
    trainingMaxKey: RequiredProgramStringSchema.optional(),
    tmPercent: z.number().positive().max(1).optional(),
    role: RoleSchema.optional(),
    notes: RequiredProgramStringSchema.optional(),
    prescriptions: z.array(SetPrescriptionSchema).min(1).max(MAX_PRESCRIPTIONS_PER_SLOT).optional(),
    percentOf: RequiredProgramStringSchema.optional(),
    isGpp: z.boolean().optional(),
    complexReps: RequiredProgramStringSchema.optional(),
    propagatesTo: RequiredProgramStringSchema.optional(),
    isTestSlot: z.boolean().optional(),
    isBodyweight: z.boolean().optional(),
    progressionSetIndex: z.number().int().nonnegative().optional(),
  })
  .refine(
    (slot) => {
      const usesUpdateTm = [
        slot.onSuccess,
        slot.onMidStageFail,
        slot.onFinalStageFail,
        slot.onFinalStageSuccess,
        slot.onUndefined,
      ].some((r) => r?.type === 'update_tm');
      return !usesUpdateTm || slot.trainingMaxKey !== undefined;
    },
    { message: 'trainingMaxKey is required when any progression rule uses update_tm' }
  );

// Upper bounds guard against malicious/oversized definitions driving the
// O(totalWorkouts x slots) compute loop in the generic engine (DoS). They sit
// well above the largest real preset (brunetti-365: 212 workouts/212 days;
// max 9 slots/day) so every legitimate client-built program still validates.
export const MAX_SLOTS_PER_DAY = 50;
export const MAX_DAYS = 1000;
export const MAX_TOTAL_WORKOUTS = 2000;
export const MAX_TOTAL_SLOTS = 5000;
export const MAX_PROGRAM_EXERCISES = 100;
export const MAX_PROGRAM_CONFIG_FIELDS = 100;
export const MAX_PROGRAM_WEIGHT_INCREMENTS = 100;
export const MAX_SELECT_OPTIONS = 100;

export const ProgramDaySchema = z.strictObject({
  name: RequiredProgramStringSchema,
  slots: z.array(ExerciseSlotSchema).min(1).max(MAX_SLOTS_PER_DAY),
});

const WeightConfigFieldSchema = z.strictObject({
  key: RequiredProgramStringSchema,
  label: RequiredProgramStringSchema,
  type: z.literal('weight'),
  min: z.number(),
  step: z.number().positive(),
  group: RequiredProgramStringSchema.optional(),
  hint: RequiredProgramStringSchema.optional(),
  groupHint: RequiredProgramStringSchema.optional(),
});

const SelectOptionSchema = z.strictObject({
  label: RequiredProgramStringSchema,
  value: RequiredProgramStringSchema,
});

const SelectConfigFieldSchema = z.strictObject({
  key: RequiredProgramStringSchema,
  label: RequiredProgramStringSchema,
  type: z.literal('select'),
  options: z.array(SelectOptionSchema).min(1).max(MAX_SELECT_OPTIONS),
  group: RequiredProgramStringSchema.optional(),
});

export const ConfigFieldSchema = z.discriminatedUnion('type', [
  WeightConfigFieldSchema,
  SelectConfigFieldSchema,
]);

export const ProgramDefinitionSchema = z
  .strictObject({
    id: RequiredProgramStringSchema,
    name: RequiredProgramStringSchema,
    description: ProgramStringSchema,
    author: ProgramStringSchema,
    version: z.number().int().positive(),
    category: ProgramStringSchema,
    source: z.enum(['preset', 'custom']),
    days: z.array(ProgramDaySchema).min(1).max(MAX_DAYS),
    cycleLength: z.number().int().positive(),
    totalWorkouts: z.number().int().positive().max(MAX_TOTAL_WORKOUTS),
    workoutsPerWeek: z.number().int().positive(),
    exercises: z
      .record(ProgramStringSchema, z.strictObject({ name: RequiredProgramStringSchema }))
      .refine((exercises) => Object.keys(exercises).length <= MAX_PROGRAM_EXERCISES, {
        message: `exercises must have at most ${MAX_PROGRAM_EXERCISES} entries`,
      }),
    configFields: z.array(ConfigFieldSchema).max(MAX_PROGRAM_CONFIG_FIELDS),
    weightIncrements: z
      .record(ProgramStringSchema, z.number().nonnegative())
      .refine((increments) => Object.keys(increments).length <= MAX_PROGRAM_WEIGHT_INCREMENTS, {
        message: `weightIncrements must have at most ${MAX_PROGRAM_WEIGHT_INCREMENTS} entries`,
      }),
    configTitle: RequiredProgramStringSchema.optional(),
    configDescription: RequiredProgramStringSchema.optional(),
    configEditTitle: RequiredProgramStringSchema.optional(),
    configEditDescription: RequiredProgramStringSchema.optional(),
    displayMode: z.enum(['flat', 'blocks']).optional(),
  })
  .refine(
    (definition) =>
      definition.days.reduce((total, day) => total + day.slots.length, 0) <= MAX_TOTAL_SLOTS,
    { message: `days must contain at most ${MAX_TOTAL_SLOTS} slots in total` }
  );

export type ProgramDefinition = z.infer<typeof ProgramDefinitionSchema>;
