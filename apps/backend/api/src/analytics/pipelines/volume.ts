/**
 * Weekly volume-trend insight (aggregate, exercise_id = null).
 *
 * Ports apps/backend/analytics/insights/volume.py. Aggregates total volume
 * (weight x reps_equivalent) per ISO week across all successful sets, then
 * reports the linear slope and a coarse up/down/flat direction.
 */

import type { WorkoutRecord } from '../record';
import { isoWeekKeyFromTimestamp } from '../iso-week';
import { pyRound } from './round';

/** Assume each set contributes a fixed rep count when actual reps are absent. */
const DEFAULT_REPS = 5;

export interface VolumeTrendPayload {
  readonly weeks: string[];
  readonly volumes: number[];
  readonly slope: number;
  readonly direction: 'up' | 'down' | 'flat';
}

export function computeVolume(records: readonly WorkoutRecord[]): VolumeTrendPayload | null {
  const weekly = new Map<string, number>();

  for (const r of records) {
    if (r.result !== 'success') continue;
    const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS;
    const volume = r.weight * reps;
    if (r.recordedAt === null) continue;
    const weekKey = isoWeekKeyFromTimestamp(r.recordedAt);
    if (weekKey === null) continue;
    weekly.set(weekKey, (weekly.get(weekKey) ?? 0) + volume);
  }

  if (weekly.size < 3) return null;

  const weeks = [...weekly.keys()].sort();
  const volumes = weeks.map((w) => weekly.get(w) ?? 0);

  const slope = linearSlope(volumes);
  const direction: VolumeTrendPayload['direction'] =
    slope > 0.5 ? 'up' : slope < -0.5 ? 'down' : 'flat';

  return {
    weeks,
    volumes,
    slope: pyRound(slope, 2),
    direction,
  };
}

/** Ordinary-least-squares slope of `values` against their indices 0..n-1,
 * matching volume.py:_linear_slope. */
function linearSlope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let xMean = 0;
  let yMean = 0;
  for (let i = 0; i < n; i++) {
    xMean += i;
    yMean += values[i];
  }
  xMean /= n;
  yMean /= n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den !== 0 ? num / den : 0;
}
