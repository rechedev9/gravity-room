import type { GenericWorkoutRow, ResultValue } from '@gzclp/shared/types';

/**
 * Detects a T1 personal record for generic (non-GZCLP) programs.
 * Same logic as above but operates on generic slot-keyed rows.
 */
export function detectGenericPersonalRecord(
  rows: readonly GenericWorkoutRow[],
  workoutIndex: number,
  slotId: string,
  value: ResultValue
): boolean {
  if (value !== 'success') return false;

  const currentRow = rows[workoutIndex];
  if (!currentRow) return false;

  const currentSlot = currentRow.slots.find((s) => s.slotId === slotId);
  if (!currentSlot || currentSlot.role !== 'primary') return false;

  const exerciseId = currentSlot.exerciseId;
  const currentWeight = currentSlot.weight;

  const priorSlots = rows
    .slice(0, workoutIndex)
    .flatMap((r) => r.slots)
    .filter((s) => s.role === 'primary' && s.exerciseId === exerciseId && s.result === 'success');

  let priorBest = -1;
  for (const slot of priorSlots) {
    if (slot.weight > priorBest) {
      priorBest = slot.weight;
    }
  }

  if (priorBest < 0) return false;

  return currentWeight > priorBest;
}
