/**
 * 1RM-forecasting insight (per exercise / slot_id).
 *
 * Ports apps/backend/analytics/ml/forecast.py. Buckets successful sets into ISO
 * weeks, takes the weekly-max Epley e1RM over the last 16 weeks (min 6 weeks),
 * fits a linear regression, and projects 2 and 4 weeks ahead with 95%
 * prediction-interval bands. An r-squared below 0.5 suppresses the forecast.
 *
 * A perfectly flat e1RM series produces r = 0 / r-squared = 0 from the Agent A
 * `linregress` port (never NaN), so it is suppressed by the r-squared check
 * with no separate NaN guard, exactly mirroring forecast.py's NaN-rvalue early
 * return.
 */

import type { WorkoutRecord } from '../record';
import { epley } from '../epley';
import { linregress, studentTQuantile } from '../stats';
import { isoWeekKeyFromTimestamp } from '../iso-week';
import { parseInstant } from './time';
import { pyRound } from './round';

const MIN_WEEKS = 6;
const R2_THRESHOLD = 0.5;
const DEFAULT_REPS = 5;
/** scipy hardcodes 1.96 as the t critical value when n <= 2 (forecast.py). */
const FALLBACK_T_CRIT = 1.96;

export interface E1rmForecastPayload {
  readonly weeks: string[];
  readonly e1rms: number[];
  readonly slope: number;
  readonly rSquared: number;
  readonly forecast2w: number;
  readonly forecast4w: number;
  readonly band2w: number;
  readonly band4w: number;
}

export function computeForecastPerExercise(
  records: readonly WorkoutRecord[]
): Map<string, E1rmForecastPayload> {
  const bySlot = new Map<string, WorkoutRecord[]>();
  for (const r of records) {
    if (r.result !== 'success') continue;
    const slot = bySlot.get(r.slotId) ?? [];
    slot.push(r);
    bySlot.set(r.slotId, slot);
  }

  const result = new Map<string, E1rmForecastPayload>();
  for (const [slotId, slotRecords] of bySlot) {
    const payload = forecastSlot(slotRecords);
    if (payload !== null) result.set(slotId, payload);
  }
  return result;
}

/**
 * Forecast a single slot's weekly e1RM trend. Exposed directly so parity tests
 * can drive it with fixed-timestamp fixtures, mirroring forecast.py's
 * `_forecast_slot`.
 */
export function forecastSlot(records: readonly WorkoutRecord[]): E1rmForecastPayload | null {
  const byWeek = new Map<string, number[]>();
  for (const r of records) {
    if (r.recordedAt === null) continue;
    // Validate the instant exactly as forecast.py does before bucketing.
    if (parseInstant(r.recordedAt) === null) continue;
    const weekKey = isoWeekKeyFromTimestamp(r.recordedAt);
    if (weekKey === null) continue;
    const reps = r.amrapReps && r.amrapReps > 0 ? r.amrapReps : DEFAULT_REPS;
    const bucket = byWeek.get(weekKey) ?? [];
    bucket.push(epley(r.weight, reps));
    byWeek.set(weekKey, bucket);
  }

  if (byWeek.size < MIN_WEEKS) return null;

  const weeks = [...byWeek.keys()].sort().slice(-16);
  const e1rms = weeks.map((w) => Math.max(...(byWeek.get(w) ?? [])));
  const n = weeks.length;
  const xs = weeks.map((_, i) => i);

  const reg = linregress(xs, e1rms);
  const rSquared = reg.rSquared;
  if (rSquared < R2_THRESHOLD) return null;

  const { slope, intercept } = reg;
  const forecast2w = intercept + slope * (n + 1);
  const forecast4w = intercept + slope * (n + 3);

  let xMean = 0;
  for (const x of xs) xMean += x;
  xMean /= n;

  let ssxx = 0;
  for (const x of xs) ssxx += (x - xMean) ** 2;

  let sse = 0;
  for (let i = 0; i < n; i++) {
    const resid = e1rms[i] - (intercept + slope * xs[i]);
    sse += resid * resid;
  }
  const mse = n > 2 ? sse / (n - 2) : 0;
  const tCrit = n > 2 ? studentTQuantile(0.975, n - 2) : FALLBACK_T_CRIT;

  const band = (xNew: number): number => {
    if (ssxx === 0 || mse === 0) return 0;
    const sePred = Math.sqrt(mse * (1 + 1 / n + (xNew - xMean) ** 2 / ssxx));
    return tCrit * sePred;
  };

  return {
    weeks,
    e1rms: e1rms.map((v) => pyRound(v, 1)),
    slope: pyRound(slope, 3),
    rSquared: pyRound(rSquared, 3),
    forecast2w: pyRound(Math.max(forecast2w, 0), 1),
    forecast4w: pyRound(Math.max(forecast4w, 0), 1),
    band2w: pyRound(band(n + 1), 1),
    band4w: pyRound(band(n + 3), 1),
  };
}
