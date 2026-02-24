import type { WorkoutRow, GenericWorkoutRow, ResultValue } from '@gzclp/shared/types';

/**
 * Detects whether marking a T1 result as 'success' at a given workout index
 * constitutes a new personal record for GZCLP programs.
 *
 * A PR requires:
 * - Tier is T1 and result is 'success'
 * - At least one prior successful T1 result for the same exercise exists
 * - Current weight strictly exceeds the prior best
 *
 * The first success at starting weight is NOT a PR (no prior success to beat).
 */
export function detectT1PersonalRecord(
  rows: readonly WorkoutRow[],
  index: number,
  tier: string,
  value: ResultValue
): boolean {
  if (tier !== 't1' || value !== 'success') return false;

  const currentRow = rows[index];
  if (!currentRow) return false;

  const exercise = currentRow.t1Exercise;
  const currentWeight = currentRow.t1Weight;

  let priorBest = -1;
  for (let i = 0; i < index; i++) {
    const row = rows[i];
    if (row.t1Exercise === exercise && row.result.t1 === 'success') {
      if (row.t1Weight > priorBest) {
        priorBest = row.t1Weight;
      }
    }
  }

  // No prior success → not a PR (first success isn't a record to beat)
  if (priorBest < 0) return false;

  return currentWeight > priorBest;
}

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
