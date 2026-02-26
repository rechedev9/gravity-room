import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Definition-derived helpers
// ---------------------------------------------------------------------------

function deriveNames(definition: ProgramDefinition): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const [id, ex] of Object.entries(definition.exercises)) {
    map[id] = ex.name;
  }
  return map;
}

/** Extract exercise IDs that appear in primary (T1) slots. */
function derivePrimaryExercises(definition: ProgramDefinition): readonly string[] {
  const ids = new Set<string>();
  for (const day of definition.days) {
    for (const slot of day.slots) {
      if (slot.tier === 't1') ids.add(slot.exerciseId);
    }
  }
  return [...ids];
}

// ─── Types ──────────────────────────────────────────────────────────

export interface PersonalRecord {
  readonly exercise: string;
  readonly displayName: string;
  readonly weight: number;
  readonly startWeight: number;
  readonly workoutIndex: number;
}

export interface StreakInfo {
  readonly current: number;
  readonly longest: number;
}

export interface VolumeStats {
  readonly totalVolume: number;
  readonly totalSets: number;
  readonly totalReps: number;
}

export interface CompletionStats {
  readonly workoutsCompleted: number;
  readonly totalWorkouts: number;
  readonly completionPct: number;
  readonly overallSuccessRate: number;
  readonly totalWeightGained: number;
}

export interface MonthlyReport {
  readonly monthLabel: string;
  readonly workoutsCompleted: number;
  readonly personalRecords: number;
  readonly totalVolume: number;
  readonly successRate: number;
  readonly totalSets: number;
  readonly totalReps: number;
}

export interface ProfileData {
  readonly personalRecords: readonly PersonalRecord[];
  readonly streak: StreakInfo;
  readonly volume: VolumeStats;
  readonly completion: CompletionStats;
  readonly monthlyReport: MonthlyReport | null;
}

// ─── Row-level helpers (generic slot-based) ─────────────────────────

interface VolumeTick {
  volume: number;
  sets: number;
  reps: number;
}

interface SuccessTick {
  isComplete: boolean;
  successes: number;
  marks: number;
}

function rowVolumeTick(row: GenericWorkoutRow): VolumeTick {
  let volume = 0;
  let sets = 0;
  let reps = 0;

  for (const slot of row.slots) {
    if (!slot.result) continue;
    const slotSets = slot.sets;
    const slotReps = slot.reps;
    // For AMRAP slots, last set uses actual amrapReps; regular sets use prescribed reps
    const regularReps = (slotSets - 1) * slotReps;
    const lastSetReps = slot.isAmrap && slot.amrapReps !== undefined ? slot.amrapReps : slotReps;
    const total = regularReps + lastSetReps;
    volume += total * slot.weight;
    sets += slotSets;
    reps += total;
  }

  return { volume, sets, reps };
}

function rowSuccessTick(row: GenericWorkoutRow): SuccessTick {
  let successes = 0;
  let marks = 0;

  for (const slot of row.slots) {
    if (slot.result) {
      marks += 1;
      if (slot.result === 'success') successes += 1;
    }
  }

  return {
    isComplete: row.slots.every((s) => s.result !== undefined),
    successes,
    marks,
  };
}

function toPercentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

// ─── Sub-computations ───────────────────────────────────────────────

function computePersonalRecords(
  rows: readonly GenericWorkoutRow[],
  config: Record<string, number>,
  primaryExercises: readonly string[],
  names: Readonly<Record<string, string>>
): readonly PersonalRecord[] {
  const best: Record<string, { weight: number; workoutIndex: number }> = {};

  for (const ex of primaryExercises) {
    best[ex] = { weight: config[ex] ?? 0, workoutIndex: -1 };
  }

  for (const row of rows) {
    for (const slot of row.slots) {
      if (
        slot.role === 'primary' &&
        slot.result === 'success' &&
        best[slot.exerciseId] &&
        slot.weight >= best[slot.exerciseId].weight
      ) {
        best[slot.exerciseId] = { weight: slot.weight, workoutIndex: row.index };
      }
    }
  }

  return primaryExercises.map((ex) => ({
    exercise: ex,
    displayName: names[ex] ?? ex,
    weight: best[ex].weight,
    startWeight: config[ex] ?? 0,
    workoutIndex: best[ex].workoutIndex,
  }));
}

function computeStreak(rows: readonly GenericWorkoutRow[], totalWorkouts: number): StreakInfo {
  let current = 0;
  let longest = 0;
  let streak = 0;

  for (let i = 0; i < totalWorkouts; i++) {
    const row = rows[i];
    if (!row) {
      current = streak;
      break;
    }

    const tick = rowSuccessTick(row);

    if (tick.isComplete) {
      streak += 1;
      if (streak > longest) longest = streak;
    } else {
      if (tick.marks === 0) {
        current = streak;
        break;
      }
      streak = 0;
    }

    if (i === totalWorkouts - 1) {
      current = streak;
    }
  }

  return { current, longest };
}

function computeVolume(rows: readonly GenericWorkoutRow[]): VolumeStats {
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;

  for (const row of rows) {
    const { volume, sets, reps } = rowVolumeTick(row);
    totalVolume += volume;
    totalSets += sets;
    totalReps += reps;
  }

  return { totalVolume: Math.round(totalVolume), totalSets, totalReps };
}

function computeCompletion(
  rows: readonly GenericWorkoutRow[],
  config: Record<string, number>,
  totalWorkouts: number,
  primaryExercises: readonly string[]
): CompletionStats {
  let completed = 0;
  let successes = 0;
  let totalMarks = 0;

  for (const row of rows) {
    const tick = rowSuccessTick(row);
    if (tick.isComplete) completed += 1;
    successes += tick.successes;
    totalMarks += tick.marks;
  }

  const lastSuccessWeight: Record<string, number> = {};
  for (const row of rows) {
    for (const slot of row.slots) {
      if (slot.role === 'primary' && slot.result === 'success') {
        lastSuccessWeight[slot.exerciseId] = slot.weight;
      }
    }
  }

  const totalWeightGained = primaryExercises.reduce((sum, ex) => {
    const gained = (lastSuccessWeight[ex] ?? config[ex] ?? 0) - (config[ex] ?? 0);
    return gained > 0 ? sum + gained : sum;
  }, 0);

  return {
    workoutsCompleted: completed,
    totalWorkouts,
    completionPct: toPercentage(completed, totalWorkouts),
    overallSuccessRate: toPercentage(successes, totalMarks),
    totalWeightGained,
  };
}

/** Find the best pre-month weight for a primary exercise from prior rows. */
function findPriorBest(
  rows: readonly GenericWorkoutRow[],
  exerciseId: string,
  beforeIndex: number,
  excludeIndices: ReadonlySet<number>,
  startWeight: number
): number {
  let best = startWeight;
  for (const prior of rows) {
    if (prior.index >= beforeIndex) break;
    if (excludeIndices.has(prior.index)) continue;
    for (const slot of prior.slots) {
      if (
        slot.role === 'primary' &&
        slot.exerciseId === exerciseId &&
        slot.result === 'success' &&
        slot.weight > best
      ) {
        best = slot.weight;
      }
    }
  }
  return best;
}

function countMonthlyPRs(
  monthRows: readonly GenericWorkoutRow[],
  allRows: readonly GenericWorkoutRow[],
  monthIndices: ReadonlySet<number>,
  config: Record<string, number>
): number {
  let count = 0;
  for (const row of monthRows) {
    for (const slot of row.slots) {
      if (slot.role !== 'primary' || slot.result !== 'success') continue;
      const priorBest = findPriorBest(
        allRows,
        slot.exerciseId,
        row.index,
        monthIndices,
        config[slot.exerciseId] ?? 0
      );
      if (slot.weight > priorBest) count += 1;
    }
  }
  return count;
}

function computeMonthlyReport(
  rows: readonly GenericWorkoutRow[],
  config: Record<string, number>,
  resultTimestamps: Readonly<Record<string, string>>
): MonthlyReport | null {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthLabel = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  const monthIndices = new Set<number>();
  for (const [indexStr, ts] of Object.entries(resultTimestamps)) {
    const date = new Date(ts);
    if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
      monthIndices.add(Number(indexStr));
    }
  }

  if (monthIndices.size === 0) return null;

  const monthRows = rows.filter((r) => monthIndices.has(r.index));

  let completed = 0;
  let successes = 0;
  let totalMarks = 0;
  let volume = 0;
  let sets = 0;
  let reps = 0;

  for (const row of monthRows) {
    const st = rowSuccessTick(row);
    if (st.isComplete) completed += 1;
    successes += st.successes;
    totalMarks += st.marks;

    const vt = rowVolumeTick(row);
    volume += vt.volume;
    sets += vt.sets;
    reps += vt.reps;
  }

  // Count PRs: primary slot successes this month that exceed pre-month best
  const prCount = countMonthlyPRs(monthRows, rows, monthIndices, config);

  return {
    monthLabel,
    workoutsCompleted: completed,
    personalRecords: prCount,
    totalVolume: Math.round(volume),
    successRate: totalMarks > 0 ? Math.round((successes / totalMarks) * 100) : 0,
    totalSets: sets,
    totalReps: reps,
  };
}

// ─── Main orchestrator ──────────────────────────────────────────────

export function computeProfileData(
  rows: readonly GenericWorkoutRow[],
  definition: ProgramDefinition,
  config: Record<string, number>,
  resultTimestamps?: Readonly<Record<string, string>>
): ProfileData {
  const names = deriveNames(definition);
  const primaryExercises = derivePrimaryExercises(definition);
  const totalWorkouts = definition.totalWorkouts;

  const hasAnyResult = rows.some((r) => r.slots.some((s) => s.result !== undefined));
  if (!hasAnyResult) {
    const personalRecords = primaryExercises.map((ex) => ({
      exercise: ex,
      displayName: names[ex] ?? ex,
      weight: config[ex] ?? 0,
      startWeight: config[ex] ?? 0,
      workoutIndex: -1,
    }));
    return {
      personalRecords,
      streak: { current: 0, longest: 0 },
      volume: { totalVolume: 0, totalSets: 0, totalReps: 0 },
      completion: {
        workoutsCompleted: 0,
        totalWorkouts,
        completionPct: 0,
        overallSuccessRate: 0,
        totalWeightGained: 0,
      },
      monthlyReport: null,
    };
  }

  const personalRecords = computePersonalRecords(rows, config, primaryExercises, names);
  const streak = computeStreak(rows, totalWorkouts);
  const volume = computeVolume(rows);
  const completion = computeCompletion(rows, config, totalWorkouts, primaryExercises);
  const monthlyReport = resultTimestamps
    ? computeMonthlyReport(rows, config, resultTimestamps)
    : null;

  return { personalRecords, streak, volume, completion, monthlyReport };
}

const volumeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatVolume(kg: number): string {
  return volumeFormatter.format(kg);
}
