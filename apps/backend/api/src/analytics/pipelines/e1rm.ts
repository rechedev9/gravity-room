/**
 * Estimated-1RM progression insight (per exercise / slot_id).
 *
 * Ports apps/backend/analytics/insights/e1rm.py. Groups successful sets by
 * slot, computes the Epley e1RM over time, and reports the dated series plus
 * the current max. Only slots with at least `MIN_POINTS` successful records
 * emit a series.
 */

import type { WorkoutRecord } from '../record';
import { epley } from '../epley';
import { wallClockDateKey } from './time';
import { compareByRecordedAtThenIndex } from './sort';
import { pyRound } from './round';

const MIN_POINTS = 4;
const DEFAULT_REPS = 5;

export interface E1rmProgressionPayload {
  readonly dates: string[];
  readonly e1rms: number[];
  readonly currentMax: number;
}

export function computeE1rmPerExercise(
  records: readonly WorkoutRecord[]
): Map<string, E1rmProgressionPayload> {
  const bySlot = new Map<string, WorkoutRecord[]>();
  for (const r of records) {
    if (r.result !== 'success') continue;
    const slot = bySlot.get(r.slotId) ?? [];
    slot.push(r);
    bySlot.set(r.slotId, slot);
  }

  const result = new Map<string, E1rmProgressionPayload>();
  for (const [slotId, slotRecords] of bySlot) {
    const payload = buildSeries(slotRecords);
    if (payload !== null) result.set(slotId, payload);
  }
  return result;
}

function buildSeries(records: readonly WorkoutRecord[]): E1rmProgressionPayload | null {
  if (records.length < MIN_POINTS) return null;

  const sorted = [...records].sort(compareByRecordedAtThenIndex);

  const dates: string[] = [];
  const e1rms: number[] = [];
  for (const r of sorted) {
    const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS;
    dates.push(formatDate(r.recordedAt, r.workoutIndex));
    e1rms.push(pyRound(epley(r.weight, reps), 1));
  }

  return {
    dates,
    e1rms,
    currentMax: Math.max(...e1rms),
  };
}

function formatDate(timestamp: string | null, workoutIndex: number): string {
  if (timestamp !== null) {
    const key = wallClockDateKey(timestamp);
    if (key !== null) return key;
  }
  return `#${workoutIndex + 1}`;
}
