import { computeProgram } from './engine';
import { NAMES, TOTAL_WORKOUTS, T1_STAGES } from './program';
import type { StartWeights, Results, WorkoutRow } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────

export interface PersonalRecord {
  readonly exercise: string;
  readonly displayName: string;
  readonly weight: number;
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

export interface ProfileData {
  readonly personalRecords: readonly PersonalRecord[];
  readonly streak: StreakInfo;
  readonly volume: VolumeStats;
  readonly completion: CompletionStats;
}

// ─── Constants ──────────────────────────────────────────────────────

const T1_EXERCISES = ['squat', 'bench', 'deadlift', 'ohp'] as const;

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
    // T1 volume
    if (row.result.t1) {
      const t1Stage = T1_STAGES[row.t1Stage];
      const regularSets = t1Stage.sets - 1; // Last set is AMRAP
      const regularReps = regularSets * t1Stage.reps;
      const amrapReps = row.result.t1Reps ?? t1Stage.reps; // Fallback to prescribed reps
      const t1Reps = regularReps + amrapReps;

      totalVolume += t1Reps * row.t1Weight;
      totalSets += t1Stage.sets;
      totalReps += t1Reps;
    }

    // T2 volume — no AMRAP, straightforward sets * reps
    if (row.result.t2) {
      const t2Reps = row.t2Sets * row.t2Reps;
      totalVolume += t2Reps * row.t2Weight;
      totalSets += row.t2Sets;
      totalReps += t2Reps;
    }

    // T3 volume — last set is AMRAP
    if (row.result.t3) {
      const t3RegularSets = 3 - 1; // 3 sets total, last is AMRAP
      const t3PrescribedReps = 15;
      const t3RegularReps = t3RegularSets * t3PrescribedReps;
      const t3AmrapReps = row.result.t3Reps ?? t3PrescribedReps;
      const t3Reps = t3RegularReps + t3AmrapReps;

      totalVolume += t3Reps * row.t3Weight;
      totalSets += 3;
      totalReps += t3Reps;
    }
  }

  return {
    totalVolume: Math.round(totalVolume),
    totalSets,
    totalReps,
  };
}

function computeCompletion(
  rows: readonly WorkoutRow[],
  startWeights: StartWeights
): CompletionStats {
  let completed = 0;
  let successes = 0;
  let totalMarks = 0;

  for (const row of rows) {
    const isComplete = !!(row.result.t1 && row.result.t2 && row.result.t3);
    if (isComplete) {
      completed += 1;
    }

    // Count individual tier results for success rate
    if (row.result.t1) {
      totalMarks += 1;
      if (row.result.t1 === 'success') successes += 1;
    }
    if (row.result.t2) {
      totalMarks += 1;
      if (row.result.t2 === 'success') successes += 1;
    }
    if (row.result.t3) {
      totalMarks += 1;
      if (row.result.t3 === 'success') successes += 1;
    }
  }

  // Total weight gained across all T1 lifts
  let totalWeightGained = 0;
  const lastSuccessWeight: Record<string, number> = {};

  for (const row of rows) {
    if (row.result.t1 === 'success') {
      lastSuccessWeight[row.t1Exercise] = row.t1Weight;
    }
  }

  for (const ex of T1_EXERCISES) {
    const gained = (lastSuccessWeight[ex] ?? startWeights[ex]) - startWeights[ex];
    if (gained > 0) {
      totalWeightGained += gained;
    }
  }

  return {
    workoutsCompleted: completed,
    totalWorkouts: TOTAL_WORKOUTS,
    completionPct: TOTAL_WORKOUTS > 0 ? Math.round((completed / TOTAL_WORKOUTS) * 100) : 0,
    overallSuccessRate: totalMarks > 0 ? Math.round((successes / totalMarks) * 100) : 0,
    totalWeightGained,
  };
}

// ─── Main orchestrator ──────────────────────────────────────────────

export function computeProfileData(startWeights: StartWeights, results: Results): ProfileData {
  const rows = computeProgram(startWeights, results);
  const personalRecords = computePersonalRecords(rows, startWeights);
  const streak = computeStreak(results);
  const volume = computeVolume(rows);
  const completion = computeCompletion(rows, startWeights);

  return { personalRecords, streak, volume, completion };
}

export function formatVolume(kg: number): string {
  return kg.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
