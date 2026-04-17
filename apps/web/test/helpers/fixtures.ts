import type { ProgramDefinition } from '@gzclp/shared/types/program';

/**
 * GZCLP definition fixture for web tests.
 * Production code now fetches this from the API; tests use this static fixture.
 */
export const GZCLP_DEFINITION_FIXTURE: ProgramDefinition = {
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
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
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
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
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
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
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
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
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

/**
 * Default start weights used across all integration tests.
 * Matches the typical beginner GZCLP setup.
 */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  squat: 60,
  bench: 40,
  deadlift: 80,
  ohp: 25,
  latpulldown: 30,
  dbrow: 15,
};

// ---------------------------------------------------------------------------
// Generic (slot-keyed) test helpers
// ---------------------------------------------------------------------------

import type { GenericResults } from '@gzclp/shared/types/program';

/** Map day index → slot IDs for GZCLP (4-day rotation). */
export const GZCLP_DAY_SLOTS: Readonly<Record<number, { t1: string; t2: string; t3: string }>> = {
  0: { t1: 'd1-t1', t2: 'd1-t2', t3: 'latpulldown-t3' },
  1: { t1: 'd2-t1', t2: 'd2-t2', t3: 'dbrow-t3' },
  2: { t1: 'd3-t1', t2: 'd3-t2', t3: 'latpulldown-t3' },
  3: { t1: 'd4-t1', t2: 'd4-t2', t3: 'dbrow-t3' },
};

/** Build N consecutive all-success workouts in generic slot-keyed format. */
export function buildGenericSuccessResults(n: number): GenericResults {
  const results: GenericResults = {};
  for (let i = 0; i < n; i++) {
    const dayIdx = i % 4;
    const slots = GZCLP_DAY_SLOTS[dayIdx];
    results[String(i)] = {
      [slots.t1]: { result: 'success' },
      [slots.t2]: { result: 'success' },
      [slots.t3]: { result: 'success' },
    };
  }
  return results;
}
