import type { ProgramDefinition } from './types/program';
import type {
  GenericWorkoutRow,
  ChartDataPoint,
  ExerciseStats,
  RpeDataPoint,
  AmrapDataPoint,
  VolumeDataPoint,
} from './types/index';

/**
 * Formats an ISO date string into a short es-ES locale label.
 * Returns `undefined` if the date string is invalid.
 *
 * - Same year: "12 feb"
 * - Prior year: "12 feb 24"
 */
function formatDateLabel(isoString: string): string | undefined {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return undefined;

  const currentYear = new Date().getFullYear();
  const dateYear = parsed.getFullYear();

  const options: Intl.DateTimeFormatOptions =
    dateYear < currentYear
      ? { month: 'short', day: 'numeric', year: '2-digit' }
      : { month: 'short', day: 'numeric' };

  return new Intl.DateTimeFormat('es-ES', options).format(parsed);
}

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
 *
 * When `resultTimestamps` is provided, populates the optional `date` and
 * `amrapReps` fields on each data point.
 */
export function extractGenericChartData(
  definition: ProgramDefinition,
  rows: readonly GenericWorkoutRow[],
  resultTimestamps?: Readonly<Record<string, string>>
): Record<string, ChartDataPoint[]> {
  const exerciseIds = Object.keys(definition.exercises);
  const data: Record<string, ChartDataPoint[]> = {};
  for (const id of exerciseIds) {
    data[id] = [];
  }

  for (const row of rows) {
    const workoutIndexStr = String(row.index);
    const timestamp = resultTimestamps?.[workoutIndexStr];
    const date = timestamp !== undefined ? formatDateLabel(timestamp) : undefined;

    for (const slot of row.slots) {
      const series = data[slot.exerciseId];
      if (!series) continue;
      series.push({
        workout: row.index + 1,
        weight: slot.weight,
        stage: slot.stage + 1,
        result: slot.result ?? null,
        date,
        amrapReps: slot.amrapReps,
      });
    }
  }

  return data;
}

export function calculateStats(data: readonly ChartDataPoint[]): ExerciseStats {
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

/**
 * Extracts RPE trend series per exercise from generic workout rows.
 *
 * Returns one array per exercise ID. An entry is included only when
 * the slot for that exercise has `rpe !== undefined`. Slots with
 * `rpe === undefined` are omitted (sparse series).
 */
export function extractGenericRpeData(
  definition: ProgramDefinition,
  rows: readonly GenericWorkoutRow[],
  resultTimestamps?: Readonly<Record<string, string>>
): Record<string, RpeDataPoint[]> {
  const exerciseIds = Object.keys(definition.exercises);
  const data: Record<string, RpeDataPoint[]> = {};
  for (const id of exerciseIds) {
    data[id] = [];
  }

  for (const row of rows) {
    const workoutIndexStr = String(row.index);
    const timestamp = resultTimestamps?.[workoutIndexStr];
    const date = timestamp !== undefined ? formatDateLabel(timestamp) : undefined;

    for (const slot of row.slots) {
      if (slot.rpe === undefined) continue;
      const series = data[slot.exerciseId];
      if (!series) continue;
      series.push({
        workout: row.index + 1,
        rpe: slot.rpe,
        date,
      });
    }
  }

  return data;
}

/**
 * Extracts AMRAP trend series per exercise from generic workout rows.
 *
 * Returns one array per exercise ID. An entry is included only when:
 * - `isAmrap === true`
 * - `amrapReps !== undefined`
 * - `amrapReps > 0`
 *
 * `amrapReps === 0` entries are excluded (they indicate "not yet entered").
 */
export function extractGenericAmrapData(
  definition: ProgramDefinition,
  rows: readonly GenericWorkoutRow[],
  resultTimestamps?: Readonly<Record<string, string>>
): Record<string, AmrapDataPoint[]> {
  const exerciseIds = Object.keys(definition.exercises);
  const data: Record<string, AmrapDataPoint[]> = {};
  for (const id of exerciseIds) {
    data[id] = [];
  }

  for (const row of rows) {
    const workoutIndexStr = String(row.index);
    const timestamp = resultTimestamps?.[workoutIndexStr];
    const date = timestamp !== undefined ? formatDateLabel(timestamp) : undefined;

    for (const slot of row.slots) {
      if (!slot.isAmrap || slot.amrapReps === undefined || slot.amrapReps <= 0) continue;
      const series = data[slot.exerciseId];
      if (!series) continue;
      series.push({
        workout: row.index + 1,
        reps: slot.amrapReps,
        weight: slot.weight,
        date,
      });
    }
  }

  return data;
}

/**
 * Computes per-workout volume totals from workout rows.
 *
 * Volume for a workout is calculated as the sum of `weight * sets * reps`
 * for all slots where `result === 'success'`.
 *
 * Workouts with no successful slots are excluded from the series
 * (sparse series showing only sessions with completed work).
 *
 * Volume values are rounded to the nearest integer.
 */
export function extractWeeklyVolumeData(
  rows: readonly GenericWorkoutRow[],
  resultTimestamps?: Readonly<Record<string, string>>
): VolumeDataPoint[] {
  const data: VolumeDataPoint[] = [];

  for (const row of rows) {
    let volumeKg = 0;
    for (const slot of row.slots) {
      if (slot.result === 'success') {
        volumeKg += slot.weight * slot.sets * slot.reps;
      }
    }

    if (volumeKg <= 0) continue;

    const workoutIndexStr = String(row.index);
    const timestamp = resultTimestamps?.[workoutIndexStr];
    const date = timestamp !== undefined ? formatDateLabel(timestamp) : undefined;

    data.push({
      workout: row.index + 1,
      volumeKg: Math.round(volumeKg),
      date,
    });
  }

  return data;
}
