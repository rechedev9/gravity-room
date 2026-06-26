/**
 * Per-exercise summary insight (per exercise / slot_id).
 *
 * Ports apps/backend/analytics/insights/summary.py. Aggregates set counts,
 * total volume, success rate, and average RPE per slot. Every slot present in
 * the records emits a payload.
 */

import type { WorkoutRecord } from '../record';
import { pyRound } from './round';

const DEFAULT_REPS = 5;

export interface ExerciseSummaryPayload {
  readonly totalSets: number;
  readonly successSets: number;
  readonly successRate: number;
  readonly totalVolume: number;
  readonly avgRpe: number | null;
}

export function computeSummaryPerExercise(
  records: readonly WorkoutRecord[]
): Map<string, ExerciseSummaryPayload> {
  const bySlot = new Map<string, WorkoutRecord[]>();
  for (const r of records) {
    const slot = bySlot.get(r.slotId) ?? [];
    slot.push(r);
    bySlot.set(r.slotId, slot);
  }

  const result = new Map<string, ExerciseSummaryPayload>();
  for (const [slotId, slotRecords] of bySlot) {
    result.set(slotId, summarise(slotRecords));
  }
  return result;
}

function summarise(records: readonly WorkoutRecord[]): ExerciseSummaryPayload {
  const totalSets = records.length;
  let successSets = 0;
  let totalVolume = 0;
  const rpeValues: number[] = [];

  for (const r of records) {
    if (r.result === 'success') {
      successSets += 1;
      const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS;
      totalVolume += r.weight * reps;
    }
    if (r.rpe !== null) rpeValues.push(r.rpe);
  }

  const successRate = totalSets ? pyRound((successSets / totalSets) * 100, 1) : 0.0;
  const avgRpe =
    rpeValues.length > 0
      ? pyRound(rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length, 1)
      : null;

  return {
    totalSets,
    successSets,
    successRate,
    totalVolume: pyRound(totalVolume, 1),
    avgRpe,
  };
}
