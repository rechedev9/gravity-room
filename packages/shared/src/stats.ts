import { computeProgram } from './engine';
import type { StartWeights, Results, ChartDataPoint, ExerciseStats } from './types';

/** GZCLP T1 exercises. Inlined from deleted program.ts. */
const T1_EXERCISES = ['squat', 'bench', 'deadlift', 'ohp'] as const;

export function extractChartData(
  startWeights: StartWeights,
  results: Results
): Record<string, ChartDataPoint[]> {
  const rows = computeProgram(startWeights, results);
  const data: Record<string, ChartDataPoint[]> = {};
  for (const ex of T1_EXERCISES) {
    data[ex] = [];
  }
  for (const row of rows) {
    data[row.t1Exercise].push({
      workout: row.index + 1,
      weight: row.t1Weight,
      stage: row.t1Stage + 1,
      result: row.result.t1 ?? null,
    });
  }
  return data;
}

export function calculateStats(data: ChartDataPoint[]): ExerciseStats {
  const marked = data.filter((d) => d.result !== null);
  const successes = marked.filter((d) => d.result === 'success');
  const fails = marked.filter((d) => d.result === 'fail');
  const first = data.length > 0 ? data[0] : null;
  // Use last marked point for actual stats, not the last projected point
  const lastMarked = marked.length > 0 ? marked[marked.length - 1] : null;

  return {
    total: marked.length,
    successes: successes.length,
    fails: fails.length,
    rate: marked.length > 0 ? Math.round((successes.length / marked.length) * 100) : 0,
    currentWeight: lastMarked ? lastMarked.weight : first ? first.weight : 0,
    startWeight: first ? first.weight : 0,
    gained: lastMarked && first ? +(lastMarked.weight - first.weight).toFixed(1) : 0,
    currentStage: lastMarked ? lastMarked.stage : 1,
  };
}
