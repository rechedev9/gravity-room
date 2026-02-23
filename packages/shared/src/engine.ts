import { computeGenericProgram } from './generic-engine';
import { GZCLP_DEFINITION } from './programs/gzclp';
import type { StartWeights, Results, WorkoutRow } from './types';
import type { GenericResults } from './types/program';
import type { GenericWorkoutRow } from './types/index';

export { roundToNearestHalf } from './generic-engine';

// Module-level lookup: for each day index, maps tier → slot id
const GZCLP_DAY_SLOT_MAP = GZCLP_DEFINITION.days.map((day) => ({
  t1: day.slots.find((s) => s.tier === 't1')?.id ?? '',
  t2: day.slots.find((s) => s.tier === 't2')?.id ?? '',
  t3: day.slots.find((s) => s.tier === 't3')?.id ?? '',
}));

function convertLegacyResultsForGzclp(results: Results): GenericResults {
  const generic: GenericResults = {};
  for (const [indexStr, res] of Object.entries(results)) {
    const dayMap = GZCLP_DAY_SLOT_MAP[Number(indexStr) % GZCLP_DEFINITION.cycleLength];
    const workoutResult: Record<
      string,
      { result?: 'success' | 'fail'; amrapReps?: number; rpe?: number }
    > = {};

    if (res.t1 !== undefined || res.t1Reps !== undefined || res.rpe !== undefined) {
      workoutResult[dayMap.t1] = { result: res.t1, amrapReps: res.t1Reps, rpe: res.rpe };
    }
    if (res.t2 !== undefined) {
      workoutResult[dayMap.t2] = { result: res.t2 };
    }
    if (res.t3 !== undefined || res.t3Reps !== undefined || res.t3Rpe !== undefined) {
      workoutResult[dayMap.t3] = { result: res.t3, amrapReps: res.t3Reps, rpe: res.t3Rpe };
    }

    if (Object.keys(workoutResult).length > 0) {
      generic[indexStr] = workoutResult;
    }
  }
  return generic;
}

function mapGenericToWorkoutRow(row: GenericWorkoutRow): WorkoutRow {
  const t1Slot = row.slots.find((s) => s.tier === 't1');
  const t2Slot = row.slots.find((s) => s.tier === 't2');
  const t3Slot = row.slots.find((s) => s.tier === 't3');

  if (t1Slot === undefined || t2Slot === undefined || t3Slot === undefined) {
    throw new Error(`Invariant violation: GZCLP day missing expected tiers at index ${row.index}`);
  }

  return {
    index: row.index,
    dayName: row.dayName,
    t1Exercise: t1Slot.exerciseId,
    t1Weight: t1Slot.weight,
    t1Stage: t1Slot.stage,
    t1Sets: t1Slot.sets,
    t1Reps: t1Slot.reps,
    t2Exercise: t2Slot.exerciseId,
    t2Weight: t2Slot.weight,
    t2Stage: t2Slot.stage,
    t2Sets: t2Slot.sets,
    t2Reps: t2Slot.reps,
    t3Exercise: t3Slot.exerciseId,
    t3Weight: t3Slot.weight,
    isChanged: t1Slot.isChanged || t2Slot.isChanged,
    result: {
      t1: t1Slot.result,
      t2: t2Slot.result,
      t3: t3Slot.result,
      t1Reps: t1Slot.amrapReps,
      t3Reps: t3Slot.amrapReps,
      rpe: t1Slot.rpe,
      t3Rpe: t3Slot.rpe,
    },
  };
}

export function computeProgram(startWeights: StartWeights, results: Results): WorkoutRow[] {
  const genericResults = convertLegacyResultsForGzclp(results);
  const genericRows = computeGenericProgram(GZCLP_DEFINITION, startWeights, genericResults);
  return genericRows.map(mapGenericToWorkoutRow);
}
