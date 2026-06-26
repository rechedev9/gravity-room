/**
 * Stable record ordering shared by the e1RM and recommendation pipelines.
 *
 * Mirrors the Python `sorted(records, key=lambda r: (r.recorded_at or "",
 * r.workout_index))`: primary key is the raw `recordedAt` string (null/None
 * collapses to the empty string and therefore sorts first), tie-broken by
 * `workoutIndex`. JavaScript's Array.prototype.sort is stable, matching
 * Python's stable sort.
 */

import type { WorkoutRecord } from '../record';

export function compareByRecordedAtThenIndex(a: WorkoutRecord, b: WorkoutRecord): number {
  const ar = a.recordedAt ?? '';
  const br = b.recordedAt ?? '';
  if (ar < br) return -1;
  if (ar > br) return 1;
  return a.workoutIndex - b.workoutIndex;
}
