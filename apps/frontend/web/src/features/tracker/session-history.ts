import { isWorkoutComplete } from '@gzclp/domain/generic-stats';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';

/** A slot is finished only once its AMRAP follow-up (if any) has been answered. */
export function isSlotResolved(slot: GenericSlotRow): boolean {
  if (slot.result === undefined) return false;
  const needsAmrap =
    slot.result === 'success' &&
    slot.isAmrap &&
    slot.amrapReps === undefined &&
    slot.setLogs === undefined;
  return !needsAmrap;
}

export function isWorkoutResolved(workout: GenericWorkoutRow): boolean {
  return workout.slots.length > 0 && workout.slots.every(isSlotResolved);
}

/**
 * The tracker moves its "current" day on to the next pending one as soon as a
 * day resolves, so the day just finished is the one right before it (or the
 * last day once the whole program is done). That is the day whose completion
 * screen is worth showing; older days are plain history.
 */
export function isLatestFinishedDay(
  rows: readonly GenericWorkoutRow[],
  workout: GenericWorkoutRow,
  currentDayIndex: number
): boolean {
  if (!isWorkoutResolved(workout)) return false;
  const latestFinished = currentDayIndex >= 0 ? currentDayIndex - 1 : rows.length - 1;
  return workout.index === latestFinished;
}

export interface PreviousLiftLine {
  readonly slotId: string;
  readonly exerciseId: string;
  readonly exerciseName: string;
  readonly weight: number;
  /** "3 3 3 3 7" when set logs exist, otherwise the prescribed scheme. */
  readonly repsSummary: string;
  readonly result: 'success' | 'fail';
}

export interface PreviousSession {
  readonly index: number;
  readonly lines: readonly PreviousLiftLine[];
}

function repsSummary(slot: GenericWorkoutRow['slots'][number]): string {
  if (slot.setLogs !== undefined && slot.setLogs.length > 0) {
    return slot.setLogs.map((s) => s.reps).join(' ');
  }
  if (slot.amrapReps !== undefined && slot.sets > 1) {
    return `${Array.from({ length: slot.sets - 1 }, () => slot.reps).join(' ')} ${slot.amrapReps}`;
  }
  return `${slot.sets}×${slot.complexReps ?? slot.reps}`;
}

/**
 * The most recent fully-recorded workout of the same day template before
 * `index` — "this same session, N days ago". Used to show what the user did
 * last time without leaving the session screen.
 */
export function findPreviousSameDay(
  rows: readonly GenericWorkoutRow[],
  index: number
): PreviousSession | null {
  const current = rows[index];
  if (current === undefined) return null;

  for (let i = index - 1; i >= 0; i--) {
    const row = rows[i];
    if (row === undefined || row.dayName !== current.dayName) continue;
    if (!isWorkoutComplete(row)) continue;

    return {
      index: i,
      lines: row.slots.map((slot) => ({
        slotId: slot.slotId,
        exerciseId: slot.exerciseId,
        exerciseName: slot.exerciseName,
        weight: slot.weight,
        repsSummary: repsSummary(slot),
        result: slot.result === 'fail' ? 'fail' : 'success',
      })),
    };
  }

  return null;
}

/**
 * The same slot in the next workout that schedules it. Because `rows` is the
 * engine's own output, this already carries the progression that the recorded
 * result produced — nothing is recomputed here.
 */
export function findNextScheduled(
  rows: readonly GenericWorkoutRow[],
  afterIndex: number,
  slotId: string
): GenericWorkoutRow['slots'][number] | null {
  for (let i = afterIndex + 1; i < rows.length; i++) {
    const found = rows[i]?.slots.find((s) => s.slotId === slotId);
    if (found !== undefined) return found;
  }
  return null;
}

/** Total kg moved in a workout, counting logged sets when available. */
export function workoutVolume(row: GenericWorkoutRow): number {
  let volume = 0;
  for (const slot of row.slots) {
    if (slot.weight <= 0) continue;
    if (slot.setLogs !== undefined && slot.setLogs.length > 0) {
      for (const set of slot.setLogs) volume += (set.weight ?? slot.weight) * set.reps;
      continue;
    }
    if (slot.result !== 'success') continue;
    const lastSetReps = slot.amrapReps ?? slot.reps;
    volume += slot.weight * (slot.reps * Math.max(0, slot.sets - 1) + lastSetReps);
  }
  return Math.round(volume);
}

/** Whole days elapsed between two ISO timestamps, or null when either is missing. */
export function daysBetween(from: string | undefined, to: string | undefined): number | null {
  if (from === undefined || to === undefined) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}
