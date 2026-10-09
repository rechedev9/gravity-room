import type { GenericWorkoutRow } from '@gzclp/domain';

import { slotIsLoadless } from './tracker-set-logging';

export function isWorkoutComplete(row: GenericWorkoutRow): boolean {
  return row.slots.length > 0 && row.slots.every((slot) => slot.result !== undefined);
}

export function firstPendingWorkout(rows: readonly GenericWorkoutRow[]): number {
  return rows.findIndex((row) => !isWorkoutComplete(row));
}

/** Sum the actual logged work, including missed targets; never invent missing sets or a load
 * for bodyweight work. */
export function recordedWorkoutVolume(row: GenericWorkoutRow): number {
  return row.slots.reduce(
    (total, slot) =>
      total +
      (slotIsLoadless(slot) ? [] : (slot.setLogs ?? [])).reduce(
        (sum, log) => sum + log.reps * (log.weight ?? slot.weight),
        0
      ),
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

type HeroRevealInput = WorkoutScrollInput & { readonly scrollY: number };

/**
 * Where to scroll so the active exercise stays on screen while the lifter works: after a set
 * grows its card, or when the rest banner takes space from the viewport. Returns null when
 * nothing needs to move. It never scrolls past the card's own top, so a card taller than the
 * viewport is not fought over.
 */
export function heroRevealTarget({
  scrollY,
  viewportHeight,
  heroTop,
  heroBottom,
  margin,
}: HeroRevealInput): number | null {
  if (heroBottom < scrollY + margin) return Math.max(0, heroTop - margin);
  const overflow = heroBottom + margin - (scrollY + viewportHeight);
  if (overflow <= 0) return null;
  const target = Math.min(heroBottom + margin - viewportHeight, Math.max(0, heroTop - margin));
  return target > scrollY ? target : null;
}
