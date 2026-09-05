import type { GenericWorkoutRow } from '@gzclp/domain';

export function isWorkoutComplete(row: GenericWorkoutRow): boolean {
  return row.slots.length > 0 && row.slots.every((slot) => slot.result !== undefined);
}

export function firstPendingWorkout(rows: readonly GenericWorkoutRow[]): number {
  return rows.findIndex((row) => !isWorkoutComplete(row));
}

/** Sum the actual logged work, including missed targets; never invent missing sets. */
export function recordedWorkoutVolume(row: GenericWorkoutRow): number {
  return row.slots.reduce(
    (total, slot) =>
      total +
      (slot.setLogs ?? []).reduce((sum, log) => sum + log.reps * (log.weight ?? slot.weight), 0),
    0
  );
}
