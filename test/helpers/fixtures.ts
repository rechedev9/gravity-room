import type { StartWeights, Results } from '@/types';
import type { StoredData } from '@/lib/storage';

/**
 * Default start weights used across all integration tests.
 * Matches the typical beginner GZCLP setup.
 */
export const DEFAULT_WEIGHTS: StartWeights = {
  squat: 60,
  bench: 40,
  deadlift: 80,
  ohp: 25,
  latpulldown: 30,
  dbrow: 15,
};

/** Build start weights with optional overrides. */
export function buildStartWeights(overrides?: Partial<StartWeights>): StartWeights {
  return { ...DEFAULT_WEIGHTS, ...overrides };
}

/** Build a results map from an array of [workoutIndex, result] tuples. */
export function buildResults(
  entries: Array<
    [
      number,
      {
        t1?: 'success' | 'fail';
        t2?: 'success' | 'fail';
        t3?: 'success' | 'fail';
        t1Reps?: number;
        t3Reps?: number;
      },
    ]
  >
): Results {
  const results: Results = {};
  for (const [index, result] of entries) {
    results[index] = result;
  }
  return results;
}

/** Build N consecutive workouts all marked as success for all tiers. */
export function buildSuccessfulResults(n: number): Results {
  const results: Results = {};
  for (let i = 0; i < n; i++) {
    results[i] = { t1: 'success', t2: 'success', t3: 'success' };
  }
  return results;
}

/** Build a full StoredData object for storage integration tests. */
export function buildStoredData(overrides?: {
  startWeights?: Partial<StartWeights>;
  results?: Results;
}): StoredData {
  return {
    startWeights: buildStartWeights(overrides?.startWeights),
    results: overrides?.results ?? {},
    undoHistory: [],
  };
}
