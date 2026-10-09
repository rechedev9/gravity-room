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

type WorkoutScrollInput = {
  readonly viewportHeight: number;
  readonly heroTop: number;
  readonly heroBottom: number;
  readonly margin: number;
};

/**
 * Scroll offset for a freshly opened workout. The header stays in view unless
 * the active exercise would end below the fold; then scroll only far enough to
 * show it, never past its own top edge.
 */
export function workoutScrollTarget({
  viewportHeight,
  heroTop,
  heroBottom,
  margin,
}: WorkoutScrollInput): number {
  const overflow = heroBottom + margin - viewportHeight;
  if (overflow <= 0) return 0;
  return Math.max(0, Math.min(overflow, heroTop - margin));
}
