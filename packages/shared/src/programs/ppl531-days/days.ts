/**
 * PPL 5/3/1 + Double Progression — Day definitions.
 * Exported as a pre-computed array so ppl531.ts can stay under 600 lines.
 */
import type { ProgramDefinition } from '../../types/program';

// ---------------------------------------------------------------------------
// Internal type aliases
// ---------------------------------------------------------------------------

type ProgramDay = ProgramDefinition['days'][number];
type ExerciseSlot = ProgramDay['slots'][number];
type ProgressionRule = ExerciseSlot['onSuccess'];

// ---------------------------------------------------------------------------
// Shared rule constants
// ---------------------------------------------------------------------------

const NO_CHANGE: ProgressionRule = { type: 'no_change' };
const ADVANCE_STAGE: ProgressionRule = { type: 'advance_stage' };

// ---------------------------------------------------------------------------
// Helper: Main lift work set (75% TM, secondary role, no TM update)
// ---------------------------------------------------------------------------

function mainWork(exerciseId: string, slotId: string, trainingMaxKey: string): ExerciseSlot {
  return {
    id: `${slotId}_work`,
    exerciseId,
    tier: 'main',
    role: 'secondary',
    trainingMaxKey,
    tmPercent: 0.75,
    stages: [{ sets: 1, reps: 5 }],
    onSuccess: NO_CHANGE,
    onUndefined: NO_CHANGE,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: trainingMaxKey,
  };
}

// ---------------------------------------------------------------------------
// Helper: Main lift AMRAP set (85% TM, primary role, update_tm on success)
// ---------------------------------------------------------------------------

function mainAmrap(
  exerciseId: string,
  slotId: string,
  trainingMaxKey: string,
  tmIncrement: number
): ExerciseSlot {
  return {
    id: `${slotId}_amrap`,
    exerciseId,
    tier: 'main',
    role: 'primary',
    trainingMaxKey,
    tmPercent: 0.85,
    stages: [{ sets: 1, reps: 5, amrap: true }],
    onSuccess: { type: 'update_tm', amount: tmIncrement, minAmrapReps: 5 },
    onUndefined: NO_CHANGE,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: trainingMaxKey,
  };
}

// ---------------------------------------------------------------------------
// Helper: Secondary compound (TM-linked volume, no progression)
// ---------------------------------------------------------------------------

function secondaryCompound(
  exerciseId: string,
  slotId: string,
  trainingMaxKey: string,
  tmPercent: number,
  sets: number,
  reps: number
): ExerciseSlot {
  return {
    id: slotId,
    exerciseId,
    tier: 'secondary',
    role: 'secondary',
    trainingMaxKey,
    tmPercent,
    stages: [{ sets, reps }],
    onSuccess: NO_CHANGE,
    onUndefined: NO_CHANGE,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: trainingMaxKey,
  };
}

// ---------------------------------------------------------------------------
// Helper: Double progression accessory 8-10 rep range
// ---------------------------------------------------------------------------

function dpAcc810(
  exerciseId: string,
  increment: number,
  sets: number,
  slotId?: string
): ExerciseSlot {
  return {
    id: slotId ?? exerciseId,
    exerciseId,
    tier: 'accessory',
    role: 'accessory',
    stages: [
      { sets, reps: 8, repsMax: 10 },
      { sets, reps: 9, repsMax: 10 },
      { sets, reps: 10, repsMax: 10 },
    ],
    onSuccess: ADVANCE_STAGE,
    onFinalStageSuccess: { type: 'add_weight_reset_stage', amount: increment },
    onUndefined: ADVANCE_STAGE,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: slotId ?? exerciseId,
  };
}

// ---------------------------------------------------------------------------
// Helper: Double progression accessory 15-20 rep range
// ---------------------------------------------------------------------------

function dpAcc1520(
  exerciseId: string,
  increment: number,
  sets: number,
  slotId?: string
): ExerciseSlot {
  return {
    id: slotId ?? exerciseId,
    exerciseId,
    tier: 'accessory',
    role: 'accessory',
    stages: [
      { sets, reps: 15, repsMax: 20 },
      { sets, reps: 16, repsMax: 20 },
      { sets, reps: 17, repsMax: 20 },
      { sets, reps: 18, repsMax: 20 },
      { sets, reps: 19, repsMax: 20 },
      { sets, reps: 20, repsMax: 20 },
    ],
    onSuccess: ADVANCE_STAGE,
    onFinalStageSuccess: { type: 'add_weight_reset_stage', amount: increment },
    onUndefined: ADVANCE_STAGE,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: slotId ?? exerciseId,
  };
}

// ---------------------------------------------------------------------------
// Day 1 — Pull A
// ---------------------------------------------------------------------------

const PULL_A: ProgramDay = {
  name: 'Pull A',
  slots: [
    mainWork('deadlift', 'deadlift_main', 'deadlift_tm'),
    mainAmrap('deadlift', 'deadlift_main', 'deadlift_tm', 5),
    dpAcc810('lat_pulldown', 2.5, 3),
    dpAcc810('seated_row', 2.5, 3),
    dpAcc1520('face_pull', 2.5, 3),
    dpAcc810('hammer_curl', 0.5, 3, 'hammer_curl_a'),
    dpAcc810('incline_curl', 0.5, 3),
  ],
};

// ---------------------------------------------------------------------------
// Day 2 — Push A
// ---------------------------------------------------------------------------

const PUSH_A: ProgramDay = {
  name: 'Push A',
  slots: [
    mainWork('bench', 'bench_main', 'bench_tm'),
    mainAmrap('bench', 'bench_main', 'bench_tm', 2.5),
    secondaryCompound('ohp', 'ohp_secondary', 'ohp_tm', 0.5, 3, 10),
    dpAcc810('incline_db_press', 0.5, 3),
    dpAcc810('triceps_pushdown', 2.5, 3),
    dpAcc810('triceps_extension', 2.5, 3),
    dpAcc1520('lateral_raise', 0.5, 3),
  ],
};

// ---------------------------------------------------------------------------
// Day 3 — Legs A
// ---------------------------------------------------------------------------

const LEGS_A: ProgramDay = {
  name: 'Legs A',
  slots: [
    mainWork('squat', 'squat_main', 'squat_tm'),
    mainAmrap('squat', 'squat_main', 'squat_tm', 5),
    dpAcc810('barbell_rdl', 0.5, 3),
    dpAcc810('bulgarian_split_squat', 0.5, 3),
    dpAcc810('cable_pull_through', 2.5, 3),
    dpAcc810('standing_calf_raise', 2.5, 5),
  ],
};

// ---------------------------------------------------------------------------
// Day 4 — Pull B
// ---------------------------------------------------------------------------

const PULL_B: ProgramDay = {
  name: 'Pull B',
  slots: [
    mainWork('pullup', 'pullup_main', 'pullup_tm'),
    mainAmrap('pullup', 'pullup_main', 'pullup_tm', 2.5),
    dpAcc810('bent_over_row', 0.5, 3),
    dpAcc810('seated_row', 2.5, 3),
    dpAcc1520('incline_row', 2.5, 5),
    dpAcc810('hammer_curl', 0.5, 4, 'hammer_curl_b'),
    dpAcc810('lying_bicep_curl', 0.5, 4),
  ],
};

// ---------------------------------------------------------------------------
// Day 5 — Push B
// ---------------------------------------------------------------------------

const PUSH_B: ProgramDay = {
  name: 'Push B',
  slots: [
    mainWork('ohp', 'ohp_main', 'ohp_tm'),
    mainAmrap('ohp', 'ohp_main', 'ohp_tm', 2.5),
    secondaryCompound('bench', 'bench_secondary', 'bench_tm', 0.5, 3, 10),
    dpAcc810('incline_db_press', 0.5, 3),
    dpAcc810('triceps_pushdown', 2.5, 3),
    dpAcc810('triceps_extension', 2.5, 3),
    dpAcc1520('lateral_raise', 0.5, 3),
  ],
};

// ---------------------------------------------------------------------------
// Day 6 — Legs B
// ---------------------------------------------------------------------------

const LEGS_B: ProgramDay = {
  name: 'Legs B',
  slots: [
    secondaryCompound('squat', 'squat_secondary', 'squat_tm', 0.6, 3, 8),
    dpAcc810('dumbbell_rdl', 0.5, 3),
    dpAcc810('bulgarian_split_squat', 0.5, 3),
    dpAcc810('seated_leg_curl', 2.5, 3),
    dpAcc810('standing_calf_raise', 2.5, 5),
  ],
};

// ---------------------------------------------------------------------------
// Export all 6 days
// ---------------------------------------------------------------------------

export const PPL531_DAYS: readonly ProgramDay[] = [PULL_A, PUSH_A, LEGS_A, PULL_B, PUSH_B, LEGS_B];
