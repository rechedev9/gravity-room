/**
 * Plateau-detection insight (per exercise / slot_id).
 *
 * Ports apps/backend/analytics/ml/plateau.py. For each slot it takes the last
 * eight weeks of successful sets (min 8 points), fits a linear regression on
 * the weekly-max weight, and flags a plateau when the slope is below
 * 0.1 kg/week and the regression p-value is above 0.1.
 *
 * Degenerate (perfectly flat) series: scipy may report the p-value as NaN or as
 * 1.0 depending on version. The Agent A `linregress` port deterministically
 * returns p-value = 1.0 / r = 0 for a flat series (never NaN), so the degenerate
 * branch is detected here purely by `slope === 0 && popStd(weights) === 0`,
 * matching plateau.py's `slope == 0.0 and np.std(ys) == 0.0` fallback.
 */

import type { WorkoutRecord } from '../record';
import { linregress } from '../stats';
import { isoWeekKeyFromTimestamp } from '../iso-week';
import { parseInstant } from './time';
import { pyRound } from './round';

const MIN_POINTS = 8;
const WEEKS_BACK = 8;
const PLATEAU_SLOPE_THRESHOLD = 0.1; // kg/week
const PLATEAU_PVALUE_THRESHOLD = 0.1;
const MAX_CONFIDENCE = 0.95;
const MS_PER_WEEK = 7 * 86_400_000;

export interface PlateauDetectionPayload {
  readonly isPlateauing: boolean;
  readonly confidence: number;
  readonly slope: number;
  readonly pValue: number;
  readonly rSquared: number;
  readonly weeksAnalyzed: number;
  readonly currentWeight: number;
}

export function computePlateauPerExercise(
  records: readonly WorkoutRecord[]
): Map<string, PlateauDetectionPayload> {
  const cutoff = Date.now() - WEEKS_BACK * MS_PER_WEEK;

  const bySlot = new Map<string, WorkoutRecord[]>();
  for (const r of records) {
    if (r.result !== 'success' || r.recordedAt === null) continue;
    const instant = parseInstant(r.recordedAt);
    if (instant === null || instant.getTime() < cutoff) continue;
    const slot = bySlot.get(r.slotId) ?? [];
    slot.push(r);
    bySlot.set(r.slotId, slot);
  }

  const result = new Map<string, PlateauDetectionPayload>();
  for (const [slotId, slotRecords] of bySlot) {
    const payload = analyzeSlot(slotRecords);
    if (payload !== null) result.set(slotId, payload);
  }
  return result;
}

/**
 * Analyze a single slot's records (already filtered to the last eight weeks of
 * successful sets by `computePlateauPerExercise`). Exposed directly so parity
 * tests can drive it with fixed-timestamp fixtures, mirroring plateau.py's
 * `_analyze_slot`.
 */
export function analyzeSlot(records: readonly WorkoutRecord[]): PlateauDetectionPayload | null {
  if (records.length < MIN_POINTS) return null;

  const byWeek = new Map<string, number[]>();
  for (const r of records) {
    if (r.recordedAt === null) continue;
    const weekKey = isoWeekKeyFromTimestamp(r.recordedAt);
    if (weekKey === null) continue;
    const bucket = byWeek.get(weekKey) ?? [];
    bucket.push(r.weight);
    byWeek.set(weekKey, bucket);
  }

  if (byWeek.size < 2) return null;

  const weeks = [...byWeek.keys()].sort();
  const weights = weeks.map((w) => Math.max(...(byWeek.get(w) ?? [])));
  const xs = weeks.map((_, i) => i);

  const reg = linregress(xs, weights);
  const slope = reg.slope;
  const degenerate = slope === 0 && populationStd(weights) === 0;
  const pValue = degenerate ? 0 : reg.pValue;
  const rSquared = degenerate ? 0 : reg.rSquared;

  const isPlateau =
    slope < PLATEAU_SLOPE_THRESHOLD && (degenerate || pValue > PLATEAU_PVALUE_THRESHOLD);

  let confidence: number;
  if (!isPlateau) {
    confidence = 0;
  } else if (degenerate) {
    confidence = MAX_CONFIDENCE;
  } else {
    confidence = Math.min(1 - pValue, MAX_CONFIDENCE);
  }

  return {
    isPlateauing: isPlateau,
    confidence: pyRound(confidence, 3),
    slope: pyRound(slope, 3),
    pValue: pyRound(pValue, 4),
    rSquared: pyRound(rSquared, 3),
    weeksAnalyzed: weeks.length,
    currentWeight: weights[weights.length - 1],
  };
}

/** Population standard deviation (ddof=0), matching numpy `np.std`. */
function populationStd(values: readonly number[]): number {
  const n = values.length;
  let mean = 0;
  for (const v of values) mean += v;
  mean /= n;
  let sumSq = 0;
  for (const v of values) {
    const d = v - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / n);
}
