import { z } from 'zod/v4';

/** Scored comparison axes (0–10). Polarity is defined in the engine. */
export const VersusAxisSchema = z.enum([
  'upperChest',
  'midChest',
  'lowerChest',
  'overloadPotential',
  'stabilityDemand',
  'skillDemand',
  'shoulderStress',
  'romStretch',
  'unilateralBalance',
  'beginnerAccessibility',
  'strengthTransferFlatBench',
]);

export type VersusAxis = z.infer<typeof VersusAxisSchema>;

export const VersusGoalSchema = z.enum([
  'hypertrophy_upper_chest',
  'hypertrophy_mid_chest',
  'hypertrophy_lower_chest',
  'general_chest_hypertrophy',
  'max_strength_bench',
  'shoulder_friendly',
  'beginner_friendly',
]);

export type VersusGoal = z.infer<typeof VersusGoalSchema>;

export const VersusEvidenceGradeSchema = z.enum([
  'meta_analysis',
  'systematic_review',
  'consistent_primary',
  'mechanistic',
]);

export type VersusEvidenceGrade = z.infer<typeof VersusEvidenceGradeSchema>;

/** Citation shape aligned with exercise-article references (zod/v4 local copy). */
export const VersusReferenceSchema = z
  .object({
    doi: z.string().min(1).optional(),
    pmid: z.string().regex(/^\d+$/).optional(),
    title: z.string().min(1),
    authors: z.string().min(1),
    year: z.number().int().min(1900).max(2100),
    url: z.string().url(),
  })
  .refine((r) => r.doi !== undefined || r.pmid !== undefined, {
    message: 'reference must include a doi or pmid',
  });

export type VersusReference = z.infer<typeof VersusReferenceSchema>;

export const VersusScoresSchema = z.object({
  upperChest: z.number().min(0).max(10),
  midChest: z.number().min(0).max(10),
  lowerChest: z.number().min(0).max(10),
  overloadPotential: z.number().min(0).max(10),
  stabilityDemand: z.number().min(0).max(10),
  skillDemand: z.number().min(0).max(10),
  shoulderStress: z.number().min(0).max(10),
  romStretch: z.number().min(0).max(10),
  unilateralBalance: z.number().min(0).max(10),
  beginnerAccessibility: z.number().min(0).max(10),
  strengthTransferFlatBench: z.number().min(0).max(10),
});

export type VersusScores = z.infer<typeof VersusScoresSchema>;

export const VersusLocalizedNameSchema = z.object({
  es: z.string().min(1),
  en: z.string().min(1),
});

export const ExerciseVersusProfileSchema = z.object({
  exerciseId: z.string().min(1),
  muscleGroupId: z.literal('chest'),
  name: VersusLocalizedNameSchema,
  equipment: z.string().min(1),
  isCompound: z.boolean(),
  scores: VersusScoresSchema,
  evidence: z
    .array(
      z.object({
        grade: VersusEvidenceGradeSchema,
        axes: z.array(VersusAxisSchema).min(1),
        reference: VersusReferenceSchema,
        note: VersusLocalizedNameSchema.optional(),
      })
    )
    .min(1),
});

export type ExerciseVersusProfile = z.infer<typeof ExerciseVersusProfileSchema>;

export const VersusRequestSchema = z.object({
  exerciseIdA: z.string().min(1),
  exerciseIdB: z.string().min(1),
  goal: VersusGoalSchema,
});

export type VersusRequest = z.infer<typeof VersusRequestSchema>;

export const VersusPointSchema = z.object({
  side: z.enum(['a', 'b']),
  axis: VersusAxisSchema,
  delta: z.number().positive(),
});

export type VersusPoint = z.infer<typeof VersusPointSchema>;

export const VersusOutcomeSchema = z.enum(['a', 'b', 'tie']);
export type VersusOutcome = z.infer<typeof VersusOutcomeSchema>;

export const VersusConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type VersusConfidence = z.infer<typeof VersusConfidenceSchema>;

export const VersusResultSchema = z.object({
  exerciseA: z.object({
    exerciseId: z.string().min(1),
    name: VersusLocalizedNameSchema,
    score: z.number(),
  }),
  exerciseB: z.object({
    exerciseId: z.string().min(1),
    name: VersusLocalizedNameSchema,
    score: z.number(),
  }),
  goal: VersusGoalSchema,
  outcome: VersusOutcomeSchema,
  winnerId: z.string().nullable(),
  confidence: VersusConfidenceSchema,
  scoreMargin: z.number().nonnegative(),
  prosA: z.array(VersusPointSchema),
  prosB: z.array(VersusPointSchema),
  sharedCaveats: z.array(
    z.enum(['same_muscle_group_only', 'goal_relative_winner', 'not_medical_advice'])
  ),
  evidence: z.array(
    z.object({
      grade: VersusEvidenceGradeSchema,
      axes: z.array(VersusAxisSchema).min(1),
      reference: VersusReferenceSchema,
      sourceExerciseId: z.string().min(1),
    })
  ),
});

export type VersusResult = z.infer<typeof VersusResultSchema>;

export const VersusErrorCodeSchema = z.enum([
  'same_exercise',
  'profile_missing',
  'muscle_group_mismatch',
  'invalid_request',
]);

export type VersusErrorCode = z.infer<typeof VersusErrorCodeSchema>;

export type VersusCompareOk = { readonly ok: true; readonly result: VersusResult };
export type VersusCompareErr = {
  readonly ok: false;
  readonly code: VersusErrorCode;
  readonly missingIds?: readonly string[];
};
export type VersusCompareResult = VersusCompareOk | VersusCompareErr;
