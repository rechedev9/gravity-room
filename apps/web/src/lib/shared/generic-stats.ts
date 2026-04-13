import type { ProgramDefinition } from './types/program';
import type {
  GenericWorkoutRow,
  GenericSlotRow,
  ChartDataPoint,
  ExerciseStats,
  RpeDataPoint,
  AmrapDataPoint,
  VolumeDataPoint,
} from './types/index';

// ---------------------------------------------------------------------------
// Cached Intl.DateTimeFormat instances (REQ-STX-001)
// ---------------------------------------------------------------------------

/** Formatter for dates in the current year: "12 feb" */
const SAME_YEAR_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  day: 'numeric',
});

/** Formatter for dates in prior years: "3 nov 25" */
const PRIOR_YEAR_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  day: 'numeric',
  year: '2-digit',
});

// ---------------------------------------------------------------------------
// Aggregated stats interface (REQ-STX-002)
// ---------------------------------------------------------------------------

/** Aggregated result of single-pass stats extraction. */
export interface AllGenericStats {
  readonly chartData: Record<string, ChartDataPoint[]>;
  readonly rpeData: Record<string, RpeDataPoint[]>;
  readonly amrapData: Record<string, AmrapDataPoint[]>;
  readonly volumeData: VolumeDataPoint[];
}

/**
 * Formats an ISO date string into a short es-ES locale label.
 * Returns `undefined` if the date string is invalid.
 *
 * Uses module-scope cached formatters — no new Intl.DateTimeFormat instances.
 *
 * - Same year: "12 feb"
 * - Prior year: "12 feb 24"
 */
function formatDateLabel(isoString: string): string | undefined {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return undefined;

  const formatter =
    parsed.getFullYear() < new Date().getFullYear() ? PRIOR_YEAR_FORMATTER : SAME_YEAR_FORMATTER;

  return formatter.format(parsed);
}

// ---------------------------------------------------------------------------
// Volume helper
// ---------------------------------------------------------------------------

/** Compute total volume (kg) for a single slot using setLogs when available. */
function computeSlotVolume(slot: GenericSlotRow): number {
  if (slot.setLogs !== undefined && slot.setLogs.length > 0) {
    return slot.setLogs.reduce<number>((sum, s) => sum + (s.weight ?? slot.weight) * s.reps, 0);
  }
  return slot.weight * slot.sets * slot.reps;
}

// ---------------------------------------------------------------------------
// Single-pass extraction (REQ-STX-002)
// ---------------------------------------------------------------------------

/**
 * Single-pass extraction of all stats data from workout rows.
 * Produces chartData, rpeData, amrapData, and volumeData in a single iteration.
 */
export function extractAllGenericStats(
  definition: ProgramDefinition,
  rows: readonly GenericWorkoutRow[],
  resultTimestamps?: Readonly<Record<string, string>>
): AllGenericStats {
  const exerciseIds = Object.keys(definition.exercises);

  const chartData: Record<string, ChartDataPoint[]> = {};
  const rpeData: Record<string, RpeDataPoint[]> = {};
  const amrapData: Record<string, AmrapDataPoint[]> = {};
  const volumeData: VolumeDataPoint[] = [];

  for (const id of exerciseIds) {
    chartData[id] = [];
    rpeData[id] = [];
    amrapData[id] = [];
  }

  for (const row of rows) {
    const workoutIndexStr = String(row.index);
    const timestamp = resultTimestamps?.[workoutIndexStr];
    const date = timestamp !== undefined ? formatDateLabel(timestamp) : undefined;
    const workoutNum = row.index + 1;

    let volumeKg = 0;

    for (const slot of row.slots) {
      // Chart data — always accumulate
      chartData[slot.exerciseId]?.push({
        workout: workoutNum,
        weight: slot.weight,
        stage: slot.stage + 1,
        result: slot.result ?? null,
        date,
        amrapReps: slot.amrapReps,
      });

      // RPE data — only when rpe is defined
      if (slot.rpe !== undefined) {
        rpeData[slot.exerciseId]?.push({ workout: workoutNum, rpe: slot.rpe, date });
      }

      // AMRAP data — only when isAmrap, amrapReps defined and > 0
      if (slot.isAmrap && slot.amrapReps !== undefined && slot.amrapReps > 0) {
        amrapData[slot.exerciseId]?.push({
          workout: workoutNum,
          reps: slot.amrapReps,
          weight: slot.weight,
          date,
        });
      }

      // Volume accumulation — only successful slots
      if (slot.result === 'success') {
        volumeKg += computeSlotVolume(slot);
      }
    }

    if (volumeKg > 0) {
      volumeData.push({ workout: workoutNum, volumeKg: Math.round(volumeKg), date });
    }
  }

  return { chartData, rpeData, amrapData, volumeData };
}

/**
 * Extracts chart data from generic program workout rows.
 * Delegates to `extractAllGenericStats` and returns the chartData portion.
 */
export function extractGenericChartData(
  definition: ProgramDefinition,
  rows: readonly GenericWorkoutRow[],
  resultTimestamps?: Readonly<Record<string, string>>
): Record<string, ChartDataPoint[]> {
  return extractAllGenericStats(definition, rows, resultTimestamps).chartData;
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
