import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

/** Extract a numeric value from a mixed config record, defaulting to 0. */
function configNum(config: Record<string, number | string>, key: string): number {
  const v = config[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

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

export interface OneRMEstimate {
  readonly exercise: string;
  readonly displayName: string;
  readonly estimatedKg: number;
  readonly sourceWeight: number;
  readonly sourceAmrapReps: number;
  readonly workoutIndex: number;
}

export interface ProfileData {
  readonly personalRecords: readonly PersonalRecord[];
  readonly streak: StreakInfo;
  readonly volume: VolumeStats;
  readonly completion: CompletionStats;
  readonly monthlyReport: MonthlyReport | null;
  readonly oneRMEstimates: readonly OneRMEstimate[];
  readonly lifetimeVolumeKg: number;
}

// ─── Row-level helpers (generic slot-based) ─────────────────────────

interface VolumeTick {
  readonly volume: number;
  readonly sets: number;
  readonly reps: number;
}

interface SuccessTick {
  readonly isComplete: boolean;
  readonly successes: number;
  readonly marks: number;
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
  config: Record<string, number | string>,
  primaryExercises: readonly string[],
  names: Readonly<Record<string, string>>
): readonly PersonalRecord[] {
  const best: Record<string, { weight: number; workoutIndex: number }> = {};

  for (const ex of primaryExercises) {
    best[ex] = { weight: configNum(config, ex), workoutIndex: -1 };
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
    startWeight: configNum(config, ex),
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
    } else if (tick.marks === 0) {
      // Fully untouched workout — streak ends
      current = streak;
      break;
    }
    // else: partial workout (marks > 0 but not complete) — streak-neutral, skip

    if (i === totalWorkouts - 1) {
      current = streak;
    }
  }

  return { current, longest };
}

export function computeVolume(rows: readonly GenericWorkoutRow[]): VolumeStats {
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
  config: Record<string, number | string>,
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
    const gained = (lastSuccessWeight[ex] ?? configNum(config, ex)) - configNum(config, ex);
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

// ─── 1RM Estimation (Epley formula) ─────────────────────────────────

const HALF_KG = 0.5;

/** Round to the nearest 0.5 kg. */
function roundToHalfKg(value: number): number {
  return Math.round(value / HALF_KG) * HALF_KG;
}

/** Check whether a slot qualifies for 1RM estimation. */
function isQualifyingAmrap(slot: GenericWorkoutRow['slots'][number], exerciseId: string): boolean {
  return (
    slot.exerciseId === exerciseId &&
    slot.tier === 't1' &&
    slot.isAmrap &&
    slot.amrapReps !== undefined &&
    slot.amrapReps >= 1 &&
    slot.result === 'success'
  );
}

/** Find the best 1RM estimate for a single exercise across all rows. */
function findBestEstimate(
  rows: readonly GenericWorkoutRow[],
  exerciseId: string
): { estimate: number; weight: number; reps: number; index: number } | undefined {
  let bestEstimate = -1;
  let bestWeight = 0;
  let bestReps = 0;
  let bestIndex = -1;

  for (const row of rows) {
    const slot = row.slots.find((s) => isQualifyingAmrap(s, exerciseId));
    if (!slot || slot.amrapReps === undefined) continue;

    const estimated = slot.weight * (1 + slot.amrapReps / 30);
    if (estimated > bestEstimate) {
      bestEstimate = estimated;
      bestWeight = slot.weight;
      bestReps = slot.amrapReps;
      bestIndex = row.index;
    }
  }

  return bestEstimate > 0
    ? { estimate: bestEstimate, weight: bestWeight, reps: bestReps, index: bestIndex }
    : undefined;
}

/**
 * Compute best estimated 1RM for each T1 exercise using the Epley formula.
 * Scans ALL successful AMRAP results and picks the highest estimate per exercise.
 * Returns one entry per qualifying exercise; empty array when no AMRAP data exists.
 */
export function compute1RMData(
  rows: readonly GenericWorkoutRow[],
  definition: ProgramDefinition
): readonly OneRMEstimate[] {
  const names = deriveNames(definition);
  const primaryExercises = derivePrimaryExercises(definition);
  const estimates: OneRMEstimate[] = [];

  for (const exerciseId of primaryExercises) {
    const best = findBestEstimate(rows, exerciseId);
    if (!best) continue;

    estimates.push({
      exercise: exerciseId,
      displayName: names[exerciseId] ?? exerciseId,
      estimatedKg: roundToHalfKg(best.estimate),
      sourceWeight: best.weight,
      sourceAmrapReps: best.reps,
      workoutIndex: best.index,
    });
  }

  return estimates;
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
  config: Record<string, number | string>
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
        configNum(config, slot.exerciseId)
      );
      if (slot.weight > priorBest) count += 1;
    }
  }
  return count;
}

const ROLLING_WINDOW_LABEL = 'Últimos 30 días';
const ROLLING_WINDOW_DAYS = 30;

function computeMonthlyReport(
  rows: readonly GenericWorkoutRow[],
  config: Record<string, number | string>,
  resultTimestamps: Readonly<Record<string, string>>
): MonthlyReport | null {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - ROLLING_WINDOW_DAYS);
  const cutoffTime = cutoff.getTime();

  const windowIndices = new Set<number>();
  for (const [indexStr, ts] of Object.entries(resultTimestamps)) {
    if (new Date(ts).getTime() >= cutoffTime) {
      windowIndices.add(Number(indexStr));
    }
  }

  if (windowIndices.size === 0) return null;

  const windowRows = rows.filter((r) => windowIndices.has(r.index));

  let completed = 0;
  let successes = 0;
  let totalMarks = 0;
  let volume = 0;
  let sets = 0;
  let reps = 0;

  for (const row of windowRows) {
    const st = rowSuccessTick(row);
    if (st.isComplete) completed += 1;
    successes += st.successes;
    totalMarks += st.marks;

    const vt = rowVolumeTick(row);
    volume += vt.volume;
    sets += vt.sets;
    reps += vt.reps;
  }

  const prCount = countMonthlyPRs(windowRows, rows, windowIndices, config);

  return {
    monthLabel: ROLLING_WINDOW_LABEL,
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
  config: Record<string, number | string>,
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
      weight: configNum(config, ex),
      startWeight: configNum(config, ex),
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
      oneRMEstimates: [],
      lifetimeVolumeKg: 0,
    };
  }

  const personalRecords = computePersonalRecords(rows, config, primaryExercises, names);
  const streak = computeStreak(rows, totalWorkouts);
  const volume = computeVolume(rows);
  const completion = computeCompletion(rows, config, totalWorkouts, primaryExercises);
  const monthlyReport = resultTimestamps
    ? computeMonthlyReport(rows, config, resultTimestamps)
    : null;
  const oneRMEstimates = compute1RMData(rows, definition);

  return {
    personalRecords,
    streak,
    volume,
    completion,
    monthlyReport,
    oneRMEstimates,
    lifetimeVolumeKg: volume.totalVolume,
  };
}

// es-ES locale uses dot as thousands separator (e.g. 75.264) matching the Spanish UI.
const volumeFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export function formatVolume(kg: number): string {
  return volumeFormatter.format(kg);
}
