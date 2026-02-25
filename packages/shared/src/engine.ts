import { computeGenericProgram } from './generic-engine';
import type { StartWeights, Results, WorkoutRow } from './types';
import type { ProgramDefinition } from './types/program';
import type { GenericResults } from './types/program';
import type { GenericWorkoutRow } from './types/index';

export { roundToNearestHalf } from './generic-engine';

/**
 * GZCLP-specific day-slot map. Fixed constant for the 4-day GZCLP rotation.
 * Inlined here to avoid computing from the definition at import time.
 * engine.ts is a legacy wrapper -- new programs use generic-engine.ts directly.
 */
const GZCLP_DAY_SLOT_MAP = [
  { t1: 'd1-t1', t2: 'd1-t2', t3: 'latpulldown-t3' },
  { t1: 'd2-t1', t2: 'd2-t2', t3: 'dbrow-t3' },
  { t1: 'd3-t1', t2: 'd3-t2', t3: 'latpulldown-t3' },
  { t1: 'd4-t1', t2: 'd4-t2', t3: 'dbrow-t3' },
] as const;

const GZCLP_CYCLE_LENGTH = 4;

/**
 * Inlined GZCLP program definition for the legacy computeProgram() wrapper.
 * This is the full ProgramDefinition that computeGenericProgram() needs.
 * Kept here (not imported from test fixtures) because engine.ts is production code.
 */
const GZCLP_DEFINITION: ProgramDefinition = {
  id: 'gzclp',
  name: 'GZCLP',
  description:
    'Un programa de progresión lineal basado en el método GZCL. ' +
    'Rotación de 4 días con ejercicios T1, T2 y T3 para desarrollar fuerza en los levantamientos compuestos principales.',
  author: 'Cody Lefever',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 4,
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  exercises: {
    squat: { name: 'Sentadilla' },
    bench: { name: 'Press Banca' },
    deadlift: { name: 'Peso Muerto' },
    ohp: { name: 'Press Militar' },
    latpulldown: { name: 'Jalón al Pecho' },
    dbrow: { name: 'Remo con Mancuernas' },
  },
  configFields: [
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift', label: 'Peso Muerto', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'ohp', label: 'Press Militar', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'latpulldown', label: 'Jalón al Pecho', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'dbrow', label: 'Remo con Mancuernas', type: 'weight', min: 2.5, step: 2.5 },
  ],
  weightIncrements: {
    squat: 5,
    bench: 2.5,
    deadlift: 5,
    ohp: 2.5,
    latpulldown: 2.5,
    dbrow: 2.5,
  },
  days: [
    {
      name: 'Día 1',
      slots: [
        {
          id: 'd1-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3 },
            { sets: 6, reps: 2 },
            { sets: 10, reps: 1 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
        {
          id: 'd1-t2',
          exerciseId: 'bench',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'bench',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'latpulldown-t3',
          exerciseId: 'latpulldown',
          tier: 't3',
          stages: [{ sets: 3, reps: 25, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'latpulldown',
        },
      ],
    },
    {
      name: 'Día 2',
      slots: [
        {
          id: 'd2-t1',
          exerciseId: 'ohp',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3 },
            { sets: 6, reps: 2 },
            { sets: 10, reps: 1 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'ohp',
        },
        {
          id: 'd2-t2',
          exerciseId: 'deadlift',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'deadlift',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'dbrow-t3',
          exerciseId: 'dbrow',
          tier: 't3',
          stages: [{ sets: 3, reps: 25, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'dbrow',
        },
      ],
    },
    {
      name: 'Día 3',
      slots: [
        {
          id: 'd3-t1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3 },
            { sets: 6, reps: 2 },
            { sets: 10, reps: 1 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'bench',
        },
        {
          id: 'd3-t2',
          exerciseId: 'squat',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'squat',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'latpulldown-t3',
          exerciseId: 'latpulldown',
          tier: 't3',
          stages: [{ sets: 3, reps: 25, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'latpulldown',
        },
      ],
    },
    {
      name: 'Día 4',
      slots: [
        {
          id: 'd4-t1',
          exerciseId: 'deadlift',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3 },
            { sets: 6, reps: 2 },
            { sets: 10, reps: 1 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'deadlift',
        },
        {
          id: 'd4-t2',
          exerciseId: 'ohp',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'ohp',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'dbrow-t3',
          exerciseId: 'dbrow',
          tier: 't3',
          stages: [{ sets: 3, reps: 25, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'dbrow',
        },
      ],
    },
  ],
};

function convertLegacyResultsForGzclp(results: Results): GenericResults {
  const generic: GenericResults = {};
  for (const [indexStr, res] of Object.entries(results)) {
    const dayMap = GZCLP_DAY_SLOT_MAP[Number(indexStr) % GZCLP_CYCLE_LENGTH];
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
