import type { GenericWorkoutRow, ResultValue } from '@gzclp/domain/types';

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

  let priorBest = -1;
  for (let rowIndex = workoutIndex - 1; rowIndex >= 0; rowIndex -= 1) {
    const priorRow = rows[rowIndex];
    if (!priorRow) continue;

    for (const slot of priorRow.slots) {
      if (
        slot.role === 'primary' &&
        slot.exerciseId === exerciseId &&
        slot.result === 'success' &&
        slot.weight > priorBest
      ) {
        priorBest = slot.weight;
      }
    }
  }

  if (priorBest < 0) return false;

  return currentWeight > priorBest;
}
