/**
 * Pure derivations that turn the active program's computed workout rows into
 * the view models the Home dashboard cards consume. Kept free of React and
 * network concerns so the mapping is unit-testable in isolation.
 */
import type { GenericWorkoutRow, GenericSlotRow } from '@gzclp/domain/types';
import { formatChartDate } from '@/components/charts/chart-theme';
import type { NextSet, NextWorkout } from './next-set-hero';
import type { LiftHistoryRow } from './use-pr-road';

/** One row of the "recent activity" list. Structurally matches RecentSessionsList's prop. */
export interface RecentSessionRow {
  readonly dateLabel: string;
  readonly dayIndex: number;
  readonly summary: string;
}

/** Extra fields spread onto the hero's ProgramInstance once real data exists. */
export interface HeroExtras {
  readonly nextWorkout?: NextWorkout;
  readonly nextSet?: NextSet | null;
  readonly lastSet?: {
    readonly weight: number;
    readonly reps: number;
    readonly deltaFromStart: number;
  };
  readonly results?: Record<string, string>;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Index of the first workout that still has at least one unmarked slot, or -1. */
export function findFirstPendingIndex(rows: readonly GenericWorkoutRow[]): number {
  const pending = rows.find((r) => r.slots.some((s) => s.result === undefined));
  return pending ? pending.index : -1;
}

function isCompleted(row: GenericWorkoutRow): boolean {
  return row.slots.length > 0 && row.slots.every((s) => s.result !== undefined);
}

/** Unique primary-lift names for a workout row, in slot order. */
function primaryLiftNames(row: GenericWorkoutRow): readonly string[] {
  const names: string[] = [];
  for (const slot of row.slots) {
    if (slot.role === 'primary' && !names.includes(slot.exerciseName)) {
      names.push(slot.exerciseName);
    }
  }
  return names;
}

/**
 * Slot the hero should headline: the first pending, weighted primary slot, then
 * any weighted pending slot, falling back to any pending slot. Weighted slots
 * are preferred so a 0 kg GPP/conditioning slot never headlines over the real
 * barbell lift on a mixed day.
 */
function heroSlot(row: GenericWorkoutRow): GenericSlotRow | undefined {
  return (
    row.slots.find((s) => s.role === 'primary' && s.result === undefined && s.weight > 0) ??
    row.slots.find((s) => s.result === undefined && s.weight > 0) ??
    row.slots.find((s) => s.result === undefined) ??
    row.slots[0]
  );
}

/** The earliest prescribed weight for an exercise (its program-start weight). */
function startWeightFor(
  rows: readonly GenericWorkoutRow[],
  exerciseId: string
): number | undefined {
  for (const row of rows) {
    const slot = row.slots.find((s) => s.exerciseId === exerciseId);
    if (slot && slot.weight > 0) return slot.weight;
  }
  return undefined;
}

/** Most recent completed primary set, with its gain since the program start. */
function buildLastSet(
  rows: readonly GenericWorkoutRow[],
  beforeIndex: number
): HeroExtras['lastSet'] {
  for (let i = Math.min(beforeIndex - 1, rows.length - 1); i >= 0; i -= 1) {
    const row = rows[i];
    if (!row) continue;
    const slot = row.slots.find((s) => s.role === 'primary' && s.result === 'success');
    if (!slot) continue;
    const start = startWeightFor(rows, slot.exerciseId) ?? slot.weight;
    return {
      weight: slot.weight,
      reps: slot.amrapReps ?? slot.reps,
      deltaFromStart: round1(slot.weight - start),
    };
  }
  return undefined;
}

/**
 * Build the hero view model from the computed rows. Returns empty extras (so the
 * hero renders its day-one state) until at least one set has been logged.
 */
export function buildHeroExtras(
  rows: readonly GenericWorkoutRow[],
  totalWorkouts: number
): HeroExtras {
  const hasResults = rows.some((r) => r.slots.some((s) => s.result !== undefined));
  if (!hasResults) return {};

  // A non-empty record signals "training has started" to the hero. Keyed by
  // workout index so it stays consistent with what was actually logged.
  const results: Record<string, string> = {};
  for (const row of rows) {
    if (row.slots.some((s) => s.result !== undefined)) {
      results[String(row.index)] = row.dayName;
    }
  }

  const firstPendingIdx = findFirstPendingIndex(rows);
  if (firstPendingIdx < 0) {
    // Everything logged but the program is still active (user hasn't pressed
    // "finish"). There's no next set to headline, so the hero renders its
    // day-one state; nothing more to derive here.
    return { results };
  }

  const pendingRow = rows[firstPendingIdx];
  const slot = pendingRow ? heroSlot(pendingRow) : undefined;
  if (!pendingRow || !slot) return { results };

  const focus = primaryLiftNames(pendingRow);
  const nextWorkout: NextWorkout = {
    dayIndex: firstPendingIdx,
    totalDays: totalWorkouts,
    weekLabel: pendingRow.dayName,
    focusLifts:
      focus.length > 0
        ? focus.join(' + ')
        : pendingRow.slots
            .slice(0, 2)
            .map((s) => s.exerciseName)
            .join(' + '),
  };
  const nextSet: NextSet = {
    weight: slot.weight,
    reps: slot.reps,
    label: slot.exerciseName,
  };

  return { results, nextWorkout, nextSet, lastSet: buildLastSet(rows, firstPendingIdx) };
}

/** Last `limit` completed workouts, most recent first. */
export function buildRecentSessions(
  rows: readonly GenericWorkoutRow[],
  resultTimestamps: Readonly<Record<string, string>>,
  limit = 4
): readonly RecentSessionRow[] {
  const out: RecentSessionRow[] = [];
  for (let i = rows.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const row = rows[i];
    if (!row || !isCompleted(row)) continue;
    const ts = resultTimestamps[String(row.index)];
    const successCount = row.slots.filter((s) => s.result === 'success').length;
    out.push({
      dateLabel: ts ? formatChartDate(ts) : '',
      dayIndex: row.index + 1,
      summary: `${row.dayName} · ${successCount}/${row.slots.length}`,
    });
  }
  return out;
}

/**
 * ISO timestamps of every completed workout, in program order. Uses the same
 * "all slots marked" completion rule and the same resultTimestamps source as
 * buildRecentSessions, so the heatmap, the streak KPI and the recent-activity
 * list all reflect one shared session history (never divergent data sources).
 */
export function buildWorkoutDates(
  rows: readonly GenericWorkoutRow[],
  resultTimestamps: Readonly<Record<string, string>>
): readonly string[] {
  const dates: string[] = [];
  for (const row of rows) {
    if (!isCompleted(row)) continue;
    const ts = resultTimestamps[String(row.index)];
    if (ts) dates.push(ts);
  }
  return dates;
}

/**
 * Build the "road to PR" history: one entry per primary lift that has at least
 * one successful set, pairing its standing best (`weight`) with the weight of
 * its next scheduled attempt (`prTarget`). computePrRoad then surfaces the lift
 * whose next attempt is the smallest step above its current best - i.e. the one
 * closest to setting a new personal record. Lifts with no pending attempt above
 * their best (steady peak, or a post-fail deload below it) fall out via the
 * `isPr` flag / non-positive delta and show the empty state instead.
 */
export function buildLiftHistory(rows: readonly GenericWorkoutRow[]): readonly LiftHistoryRow[] {
  const best = new Map<string, number>();
  const name = new Map<string, string>();
  const nextTarget = new Map<string, number>();

  for (const row of rows) {
    for (const slot of row.slots) {
      if (slot.role !== 'primary') continue;
      if (!name.has(slot.exerciseId)) name.set(slot.exerciseId, slot.exerciseName);
      if (slot.result === 'success' && slot.weight > (best.get(slot.exerciseId) ?? -Infinity)) {
        best.set(slot.exerciseId, slot.weight);
      }
      if (slot.result === undefined && !nextTarget.has(slot.exerciseId) && slot.weight > 0) {
        nextTarget.set(slot.exerciseId, slot.weight);
      }
    }
  }

  const history: LiftHistoryRow[] = [];
  for (const [exerciseId, current] of best) {
    const target = nextTarget.get(exerciseId);
    if (target === undefined) continue;
    history.push({
      lift: name.get(exerciseId) ?? exerciseId,
      weight: current,
      prTarget: target,
      isPr: current >= target,
    });
  }
  return history;
}
