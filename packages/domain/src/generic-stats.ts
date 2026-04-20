import type { ProgramDefinition } from './types/program';
import type {
  GenericWorkoutRow,
  GenericSlotRow,
  ChartDataPoint,
  ExerciseStats,
  RpeDataPoint,
  AmrapDataPoint,
  VolumeDataPoint,
} from './types';

const SAME_YEAR_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  day: 'numeric',
});

const PRIOR_YEAR_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  month: 'short',
  day: 'numeric',
  year: '2-digit',
});

export interface AllGenericStats {
  readonly chartData: Record<string, ChartDataPoint[]>;
  readonly rpeData: Record<string, RpeDataPoint[]>;
  readonly amrapData: Record<string, AmrapDataPoint[]>;
  readonly volumeData: VolumeDataPoint[];
}

function formatDateLabel(isoString: string): string | undefined {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return undefined;

  const formatter =
    parsed.getFullYear() < new Date().getFullYear() ? PRIOR_YEAR_FORMATTER : SAME_YEAR_FORMATTER;

  return formatter.format(parsed);
}

function computeSlotVolume(slot: GenericSlotRow): number {
  if (slot.setLogs !== undefined && slot.setLogs.length > 0) {
    return slot.setLogs.reduce<number>((sum, s) => sum + (s.weight ?? slot.weight) * s.reps, 0);
  }
  return slot.weight * slot.sets * slot.reps;
}

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
      chartData[slot.exerciseId]?.push({
        workout: workoutNum,
        weight: slot.weight,
        stage: slot.stage + 1,
        result: slot.result ?? null,
        date,
        amrapReps: slot.amrapReps,
      });

      if (slot.rpe !== undefined) {
        rpeData[slot.exerciseId]?.push({ workout: workoutNum, rpe: slot.rpe, date });
      }

      if (slot.isAmrap && slot.amrapReps !== undefined && slot.amrapReps > 0) {
        amrapData[slot.exerciseId]?.push({
          workout: workoutNum,
          reps: slot.amrapReps,
          weight: slot.weight,
          date,
        });
      }

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
