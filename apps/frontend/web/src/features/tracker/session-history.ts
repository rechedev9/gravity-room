import type { GenericWorkoutRow } from '@gzclp/domain/types';

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
    if (row.slots.length === 0 || !row.slots.every((s) => s.result !== undefined)) continue;

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

/** Whole days elapsed between two ISO timestamps, or null when either is missing. */
export function daysBetween(from: string | undefined, to: string | undefined): number | null {
  if (from === undefined || to === undefined) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}
