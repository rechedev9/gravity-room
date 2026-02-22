import { computeProgram } from '@gzclp/shared/engine';
import {
  NAMES,
  TOTAL_WORKOUTS,
  T1_STAGES,
  T1_EXERCISES,
  T3_SETS,
  T3_PRESCRIBED_REPS,
} from '@gzclp/shared/program';
import type { StartWeights, Results, WorkoutRow } from '@gzclp/shared/types';

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

// ─── Row-level helpers (shared between computeVolume / computeMonthlyReport) ─

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

function rowVolumeTick(row: WorkoutRow): VolumeTick {
  let volume = 0;
  let sets = 0;
  let reps = 0;

  if (row.result.t1) {
    const stage = T1_STAGES[row.t1Stage];
    const regularReps = (stage.sets - 1) * stage.reps;
    const amrapReps = row.result.t1Reps ?? stage.reps;
    const total = regularReps + amrapReps;
    volume += total * row.t1Weight;
    sets += stage.sets;
    reps += total;
  }
  if (row.result.t2) {
    const total = row.t2Sets * row.t2Reps;
    volume += total * row.t2Weight;
    sets += row.t2Sets;
    reps += total;
  }
  if (row.result.t3) {
    const regularReps = (T3_SETS - 1) * T3_PRESCRIBED_REPS;
    const amrapReps = row.result.t3Reps ?? T3_PRESCRIBED_REPS;
    const total = regularReps + amrapReps;
    volume += total * row.t3Weight;
    sets += T3_SETS;
    reps += total;
  }

  return { volume, sets, reps };
}

function rowSuccessTick(row: WorkoutRow): SuccessTick {
  let successes = 0;
  let marks = 0;

  if (row.result.t1) {
    marks += 1;
    if (row.result.t1 === 'success') successes += 1;
  }
  if (row.result.t2) {
    marks += 1;
    if (row.result.t2 === 'success') successes += 1;
  }
  if (row.result.t3) {
    marks += 1;
    if (row.result.t3 === 'success') successes += 1;
  }

  return {
    isComplete: !!(row.result.t1 && row.result.t2 && row.result.t3),
    successes,
    marks,
  };
}

function toPercentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

// ─── Sub-computations ───────────────────────────────────────────────

function computePersonalRecords(
  rows: readonly WorkoutRow[],
  startWeights: StartWeights
): readonly PersonalRecord[] {
  const best: Record<string, { weight: number; workoutIndex: number }> = {};

  for (const ex of T1_EXERCISES) {
    best[ex] = { weight: startWeights[ex], workoutIndex: -1 };
  }

  for (const row of rows) {
    if (row.result.t1 === 'success' && row.t1Weight >= best[row.t1Exercise].weight) {
      best[row.t1Exercise] = { weight: row.t1Weight, workoutIndex: row.index };
    }
  }

  return T1_EXERCISES.map((ex) => ({
    exercise: ex,
    displayName: NAMES[ex] ?? ex,
    weight: best[ex].weight,
    startWeight: startWeights[ex],
    workoutIndex: best[ex].workoutIndex,
  }));
}

function computeStreak(results: Results): StreakInfo {
  let current = 0;
  let longest = 0;
  let streak = 0;

  for (let i = 0; i < TOTAL_WORKOUTS; i++) {
    const res = results[i];
    const isComplete = !!(res?.t1 && res?.t2 && res?.t3);

    if (isComplete) {
      streak += 1;
      if (streak > longest) {
        longest = streak;
      }
    } else {
      // If we haven't marked anything for this workout, the streak is "live"
      const hasAnyMark = !!(res?.t1 || res?.t2 || res?.t3);
      if (!hasAnyMark) {
        // This is an unmarked workout — current streak ends here
        current = streak;
        break;
      }
      // Partial workout breaks the streak
      streak = 0;
    }

    // If we've gone through all marked workouts
    if (i === TOTAL_WORKOUTS - 1) {
      current = streak;
    }
  }

  return { current, longest };
}

function computeVolume(rows: readonly WorkoutRow[]): VolumeStats {
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
  rows: readonly WorkoutRow[],
  startWeights: StartWeights
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
    if (row.result.t1 === 'success') lastSuccessWeight[row.t1Exercise] = row.t1Weight;
  }

  const totalWeightGained = T1_EXERCISES.reduce((sum, ex) => {
    const gained = (lastSuccessWeight[ex] ?? startWeights[ex]) - startWeights[ex];
    return gained > 0 ? sum + gained : sum;
  }, 0);

  return {
    workoutsCompleted: completed,
    totalWorkouts: TOTAL_WORKOUTS,
    completionPct: toPercentage(completed, TOTAL_WORKOUTS),
    overallSuccessRate: toPercentage(successes, totalMarks),
    totalWeightGained,
  };
}

function computeMonthlyReport(
  rows: readonly WorkoutRow[],
  startWeights: StartWeights,
  resultTimestamps: Readonly<Record<string, string>>
): MonthlyReport | null {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthLabel = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  // Find workout indices that fall in the current month
  const monthIndices = new Set<number>();
  for (const [indexStr, ts] of Object.entries(resultTimestamps)) {
    const date = new Date(ts);
    if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
      monthIndices.add(Number(indexStr));
    }
  }

  if (monthIndices.size === 0) return null;

  // Filter rows to this month's workouts
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

  // Count PRs: T1 successes this month that exceed pre-month best
  let prCount = 0;
  const startWeightLookup: Record<string, number> = { ...startWeights };
  for (const row of monthRows) {
    if (row.result.t1 !== 'success') continue;
    const exercise = row.t1Exercise;
    let priorBest = startWeightLookup[exercise] ?? 0;
    for (const prior of rows) {
      if (prior.index >= row.index) break;
      const isMatch =
        !monthIndices.has(prior.index) &&
        prior.t1Exercise === exercise &&
        prior.result.t1 === 'success' &&
        prior.t1Weight > priorBest;
      if (isMatch) priorBest = prior.t1Weight;
    }
    if (row.t1Weight > priorBest) prCount += 1;
  }

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
  startWeights: StartWeights,
  results: Results,
  resultTimestamps?: Readonly<Record<string, string>>
): ProfileData {
  const rows = computeProgram(startWeights, results);
  const personalRecords = computePersonalRecords(rows, startWeights);
  const streak = computeStreak(results);
  const volume = computeVolume(rows);
  const completion = computeCompletion(rows, startWeights);
  const monthlyReport = resultTimestamps
    ? computeMonthlyReport(rows, startWeights, resultTimestamps)
    : null;

  return { personalRecords, streak, volume, completion, monthlyReport };
}

const volumeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatVolume(kg: number): string {
  return volumeFormatter.format(kg);
}
