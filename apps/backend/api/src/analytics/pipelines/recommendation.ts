/**
 * Load-recommendation insight (per exercise / slot_id).
 *
 * Ports apps/backend/analytics/ml/recommendation.py. With at least 10 RPE-logged
 * sessions and both outcome classes present, it trains a logistic-regression
 * model on [weight, success_rate_at_weight, avg_rpe, volume_last_7d,
 * days_since_last] and recommends a +2.5 kg increment when the modelled success
 * probability at the heavier load is >= 0.70. Otherwise (or for a single-class
 * training set) it falls back to the "3 consecutive successes -> increment"
 * heuristic.
 *
 * The single-class fallback is the caller's responsibility here (scikit-learn
 * rejects < 2 classes), guarded by `distinctClassCount(labels) < 2` before
 * fitting, exactly as recommendation.py routes to `_fallback_recommendation`.
 */

import type { WorkoutRecord } from '../record';
import { distinctClassCount, standardizeTrainPredict } from '../logistic';
import { parseInstant } from './time';
import { compareByRecordedAtThenIndex } from './sort';
import { pyRound } from './round';

const MIN_RPE_SESSIONS = 10;
const SUCCESS_PROB_THRESHOLD = 0.7;
const INCREMENT_KG = 2.5;
const DEFAULT_REPS = 5;
const MS_PER_WEEK = 7 * 86_400_000;
const MS_PER_DAY = 86_400_000;

export interface LoadRecommendationPayload {
  readonly currentWeight: number;
  readonly recommendedWeight: number;
  readonly shouldIncrement: boolean;
  readonly confidence: number;
  readonly method: 'logistic_regression' | 'consecutive_success';
}

export function computeRecommendationPerExercise(
  records: readonly WorkoutRecord[]
): Map<string, LoadRecommendationPayload> {
  const bySlot = new Map<string, WorkoutRecord[]>();
  for (const r of records) {
    const slot = bySlot.get(r.slotId) ?? [];
    slot.push(r);
    bySlot.set(r.slotId, slot);
  }

  const result = new Map<string, LoadRecommendationPayload>();
  for (const [slotId, slotRecords] of bySlot) {
    const payload = recommendSlot(slotRecords);
    if (payload !== null) result.set(slotId, payload);
  }
  return result;
}

/** Recommend for a single slot. Mirrors recommendation.py's `_recommend_slot`. */
export function recommendSlot(records: readonly WorkoutRecord[]): LoadRecommendationPayload | null {
  if (records.length === 0) return null;

  const sorted = [...records].sort(compareByRecordedAtThenIndex);
  const currentWeight = sorted[sorted.length - 1].weight;
  const currentDate = sorted[sorted.length - 1].recordedAt;

  const rpeRecords = sorted.filter((r) => r.rpe !== null);
  if (rpeRecords.length >= MIN_RPE_SESSIONS) {
    return mlRecommendation(sorted, rpeRecords, currentWeight, currentDate);
  }
  return fallbackRecommendation(sorted, currentWeight);
}

/**
 * Logistic-regression recommendation. Exposed directly so parity tests can
 * drive it with fixed fixtures, mirroring recommendation.py's
 * `_ml_recommendation`.
 */
export function mlRecommendation(
  allRecords: readonly WorkoutRecord[],
  rpeRecords: readonly WorkoutRecord[],
  currentWeight: number,
  currentDate: string | null
): LoadRecommendationPayload {
  const weightOutcomes = new Map<number, number[]>();
  for (const r of allRecords) {
    const bucket = weightOutcomes.get(r.weight) ?? [];
    bucket.push(r.result === 'success' ? 1 : 0);
    weightOutcomes.set(r.weight, bucket);
  }

  const successRate = (w: number): number => {
    const outcomes = weightOutcomes.get(w);
    if (!outcomes || outcomes.length === 0) return 0.5;
    return outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
  };

  const volumeLastWeek = volumeForDate(allRecords, currentDate);
  const daysSince = daysSinceLast(allRecords, currentDate);

  const features: number[][] = [];
  const labels: number[] = [];
  for (const r of rpeRecords) {
    features.push([
      r.weight,
      successRate(r.weight),
      r.rpe ?? 0,
      volumeForDate(allRecords, r.recordedAt),
      daysSinceFor(allRecords, r.recordedAt),
    ]);
    labels.push(r.result === 'success' ? 1 : 0);
  }

  if (distinctClassCount(labels) < 2) {
    return fallbackRecommendation(allRecords, currentWeight);
  }

  const srCurrent = successRate(currentWeight);
  const srNext = successRate(currentWeight + INCREMENT_KG);
  const xCurrent = [currentWeight, srCurrent, 5.0, volumeLastWeek, daysSince];
  const xNext = [currentWeight + INCREMENT_KG, srNext, 5.0, volumeLastWeek, daysSince];

  const { probabilities } = standardizeTrainPredict(features, labels, [xCurrent, xNext]);
  const probCurrent = probabilities[0];
  const probNext = probabilities[1];

  const recommend = probNext >= SUCCESS_PROB_THRESHOLD;
  const recommendedWeight = recommend ? currentWeight + INCREMENT_KG : currentWeight;
  const confidence = recommend ? probNext : probCurrent;

  return {
    currentWeight,
    recommendedWeight,
    shouldIncrement: recommend,
    confidence: pyRound(Math.min(confidence, 0.99), 3),
    method: 'logistic_regression',
  };
}

/**
 * Fallback heuristic: increment after three consecutive successes. Exposed
 * directly for parity tests, mirroring recommendation.py's
 * `_fallback_recommendation`.
 */
export function fallbackRecommendation(
  records: readonly WorkoutRecord[],
  currentWeight: number
): LoadRecommendationPayload {
  const lastThree = records.slice(-3);
  const allSuccess = lastThree.length >= 3 && lastThree.every((r) => r.result === 'success');
  return {
    currentWeight,
    recommendedWeight: allSuccess ? currentWeight + INCREMENT_KG : currentWeight,
    shouldIncrement: allSuccess,
    confidence: allSuccess ? 0.7 : 0.5,
    method: 'consecutive_success',
  };
}

function volumeForDate(records: readonly WorkoutRecord[], refDate: string | null): number {
  if (!refDate) return 0;
  const ref = parseInstant(refDate);
  if (ref === null) return 0;
  return volumeInWindow(records, new Date(ref.getTime() - MS_PER_WEEK), ref);
}

function volumeInWindow(records: readonly WorkoutRecord[], start: Date, end: Date): number {
  let total = 0;
  for (const r of records) {
    if (r.recordedAt === null || r.result !== 'success') continue;
    const dt = parseInstant(r.recordedAt);
    if (dt === null) continue;
    if (dt >= start && dt < end) {
      // Python uses `r.amrap_reps or 5`: null/0 fall through to 5.
      const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS;
      total += r.weight * reps;
    }
  }
  return total;
}

function daysSinceLast(records: readonly WorkoutRecord[], currentDate: string | null): number {
  if (!currentDate) return 7;
  const now = parseInstant(currentDate);
  if (now === null) return 7;
  // reversed(records[:-1]): most recent prior record with a valid timestamp.
  for (let i = records.length - 2; i >= 0; i--) {
    const dt = parseValidInstant(records[i]);
    if (dt === null) continue;
    return Math.max(0, Math.floor((now.getTime() - dt.getTime()) / MS_PER_DAY));
  }
  return 7;
}

function daysSinceFor(records: readonly WorkoutRecord[], refDate: string | null): number {
  if (!refDate) return 7;
  const ref = parseInstant(refDate);
  if (ref === null) return 7;
  // reversed(records): most recent record strictly before refDate (string
  // comparison, matching `r.recorded_at >= ref_date`).
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.recordedAt === null || r.recordedAt >= refDate) continue;
    const dt = parseInstant(r.recordedAt);
    if (dt === null) continue;
    return Math.max(0, Math.floor((ref.getTime() - dt.getTime()) / MS_PER_DAY));
  }
  return 7;
}

function parseValidInstant(record: WorkoutRecord): Date | null {
  if (record.recordedAt === null) return null;
  return parseInstant(record.recordedAt);
}
