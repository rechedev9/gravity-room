import type { ProgramDefinition } from './types/program';
import type { GenericWorkoutRow, ChartDataPoint, ExerciseStats } from './types/index';

/**
 * Extracts chart data from generic program workout rows.
 *
 * Groups data points by **exerciseId** (not slotId), producing one continuous
 * series per exercise across all cycle/phase variants. For example, press_mil
 * appears via slot IDs like `press_mil-c1b1`, `press_mil-c2b2`, etc., but
 * they all map to the same `press_mil` series.
 *
 * Only includes data points where the exercise actually appears in a workout
 * (not every workout has every exercise).
 */
export function extractGenericChartData(
  definition: ProgramDefinition,
  rows: readonly GenericWorkoutRow[]
): Record<string, ChartDataPoint[]> {
  const exerciseIds = Object.keys(definition.exercises);
  const data: Record<string, ChartDataPoint[]> = {};
  for (const id of exerciseIds) {
    data[id] = [];
  }

  for (const row of rows) {
    for (const slot of row.slots) {
      const series = data[slot.exerciseId];
      if (!series) continue;
      series.push({
        workout: row.index + 1,
        weight: slot.weight,
        stage: slot.stage + 1,
        result: slot.result ?? null,
      });
    }
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
