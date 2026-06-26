/**
 * Golden parity tests for the seven analytics pipelines.
 *
 * The oracle is `__fixtures__/golden.json`, whose `pipelines` section is emitted
 * by `__fixtures__/generate_golden.py` running the LIVE Python pipeline
 * functions (insights/volume.py, ml/forecast.py, ml/recommendation.py, ...) on
 * fixed-timestamp fixtures. Each case stores the input records (camelCase
 * WorkoutRecord shape) and the exact payload the Python service produced. These
 * tests rebuild the records, run the TypeScript port, and assert byte-for-byte
 * payload parity within a documented numeric tolerance.
 *
 * Tolerances:
 *   - Pure-arithmetic / Epley pipelines (volume, frequency, e1rm, summary):
 *     exact to ~1e-6.
 *   - Regression pipelines (plateau, forecast): the Agent A scipy-port matches
 *     scipy linregress / t-quantile to ~1e-6, so rounded payload fields agree to
 *     3 decimals.
 *   - The recommendation ML path uses a JS IRLS logistic regression vs.
 *     scikit-learn's lbfgs; predict_proba parity is ~2e-3, so the rounded
 *     confidence is asserted within 5e-3 (booleans/weights/method exact).
 */

import { describe, it, expect } from 'vitest';
import type { WorkoutRecord } from '../record';
import { computeVolume } from './volume';
import { computeFrequency } from './frequency';
import { computeE1rmPerExercise } from './e1rm';
import { computeSummaryPerExercise } from './summary';
import { analyzeSlot } from './plateau';
import { forecastSlot } from './forecast';
import { recommendSlot } from './recommendation';
import golden from '../__fixtures__/golden.json';

const P = golden.pipelines;

function toRecords(raw: readonly unknown[]): WorkoutRecord[] {
  return raw.map((entry) => {
    const o = entry as Record<string, unknown>;
    return {
      userId: String(o['userId']),
      instanceId: String(o['instanceId']),
      programId: String(o['programId']),
      workoutIndex: Number(o['workoutIndex']),
      slotId: String(o['slotId']),
      weight: Number(o['weight']),
      result: String(o['result']),
      rpe: o['rpe'] === null ? null : Number(o['rpe']),
      amrapReps: o['amrapReps'] === null ? null : Number(o['amrapReps']),
      recordedAt: o['recordedAt'] === null ? null : String(o['recordedAt']),
    };
  });
}

/** Assert a numeric field matches the oracle to `digits` decimals. */
function expectClose(actual: number, expected: number, digits = 3): void {
  expect(actual).toBeCloseTo(expected, digits);
}

describe('volume parity', () => {
  it('matches the Python volume_trend payload', () => {
    const expected = P.volume.payload;
    const result = computeVolume(toRecords(P.volume.records));
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.weeks).toEqual(expected.weeks);
    expect(String(result.direction)).toBe(expected.direction);
    expectClose(result.slope, expected.slope, 6);
    expect(result.volumes.length).toBe(expected.volumes.length);
    result.volumes.forEach((v, i) => expectClose(v, expected.volumes[i]!, 6));
  });
});

describe('frequency parity', () => {
  it('matches the Python frequency payload', () => {
    const expected = P.frequency.payload;
    const result = computeFrequency(toRecords(P.frequency.records));
    expect(result).not.toBeNull();
    if (result === null) return;
    expectClose(result.sessionsPerWeek, expected.sessionsPerWeek, 6);
    expect(result.currentStreak).toBe(expected.currentStreak);
    expectClose(result.consistencyPct, expected.consistencyPct, 6);
    expect(result.totalSessions).toBe(expected.totalSessions);
    expect(result.workoutDates).toEqual(expected.workoutDates);
  });
});

describe('e1rm parity', () => {
  it('matches the Python e1rm_progression payload per slot', () => {
    const expected = P.e1rm.payload;
    const result = computeE1rmPerExercise(toRecords(P.e1rm.records));
    const slot = result.get('squat');
    expect(slot).toBeDefined();
    if (!slot) return;
    expect(slot.dates).toEqual(expected.squat.dates);
    expectClose(slot.currentMax, expected.squat.currentMax, 6);
    expect(slot.e1rms.length).toBe(expected.squat.e1rms.length);
    slot.e1rms.forEach((v, i) => expectClose(v, expected.squat.e1rms[i]!, 6));
  });
});

describe('summary parity', () => {
  it('matches the Python exercise_summary payload per slot', () => {
    const expected = P.summary.payload;
    const result = computeSummaryPerExercise(toRecords(P.summary.records));
    const slot = result.get('squat');
    expect(slot).toBeDefined();
    if (!slot) return;
    expect(slot.totalSets).toBe(expected.squat.totalSets);
    expect(slot.successSets).toBe(expected.squat.successSets);
    expectClose(slot.successRate, expected.squat.successRate, 6);
    expectClose(slot.totalVolume, expected.squat.totalVolume, 6);
    expect(slot.avgRpe).not.toBeNull();
    if (slot.avgRpe !== null) expectClose(slot.avgRpe, expected.squat.avgRpe!, 6);
  });
});

describe('plateau parity (analyzeSlot)', () => {
  const cases = [
    { name: 'flat (degenerate)', fixture: P.plateauFlat },
    { name: 'increasing (not plateau)', fixture: P.plateauIncreasing },
    { name: 'mild (non-degenerate plateau)', fixture: P.plateauMild },
  ];
  for (const c of cases) {
    it(`matches the Python plateau payload on ${c.name}`, () => {
      const expected = c.fixture.payload;
      const result = analyzeSlot(toRecords(c.fixture.records));
      expect(result).not.toBeNull();
      if (result === null) return;
      expect(result.isPlateauing).toBe(expected.isPlateauing);
      expect(result.weeksAnalyzed).toBe(expected.weeksAnalyzed);
      expectClose(result.confidence, expected.confidence, 3);
      expectClose(result.slope, expected.slope, 3);
      expectClose(result.pValue, expected.pValue, 3);
      expectClose(result.rSquared, expected.rSquared, 3);
      expectClose(result.currentWeight, expected.currentWeight, 6);
    });
  }
});

describe('forecast parity (forecastSlot)', () => {
  const cases = [
    { name: 'linear (perfect fit)', fixture: P.forecastLinear },
    { name: 'noisy (non-zero bands)', fixture: P.forecastNoisy },
  ];
  for (const c of cases) {
    it(`matches the Python forecast payload on ${c.name}`, () => {
      const expected = c.fixture.payload;
      expect(expected).not.toBeNull();
      const result = forecastSlot(toRecords(c.fixture.records));
      expect(result).not.toBeNull();
      if (result === null || expected === null) return;
      expect(result.weeks).toEqual(expected.weeks);
      expect(result.e1rms.length).toBe(expected.e1rms.length);
      result.e1rms.forEach((v, i) => expectClose(v, expected.e1rms[i]!, 3));
      expectClose(result.slope, expected.slope, 3);
      expectClose(result.rSquared, expected.rSquared, 3);
      expectClose(result.forecast2w, expected.forecast2w, 2);
      expectClose(result.forecast4w, expected.forecast4w, 2);
      expectClose(result.band2w, expected.band2w, 2);
      expectClose(result.band4w, expected.band4w, 2);
    });
  }

  it('suppresses a low r-squared series exactly as Python (null)', () => {
    expect(P.forecastLowR2.payload).toBeNull();
    expect(forecastSlot(toRecords(P.forecastLowR2.records))).toBeNull();
  });
});

describe('recommendation parity (recommendSlot)', () => {
  it('matches the Python ML logistic_regression payload', () => {
    const expected = P.recommendationMl.payload;
    const result = recommendSlot(toRecords(P.recommendationMl.records));
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(String(result.method)).toBe(expected.method);
    expectClose(result.currentWeight, expected.currentWeight, 6);
    expectClose(result.recommendedWeight, expected.recommendedWeight, 6);
    expect(result.shouldIncrement).toBe(expected.shouldIncrement);
    // JS IRLS vs scikit-learn lbfgs: predict_proba parity ~2e-3.
    expect(Math.abs(result.confidence - expected.confidence)).toBeLessThan(5e-3);
  });

  const fallbacks = [
    { name: 'increment', fixture: P.recommendationFallbackIncrement },
    { name: 'hold', fixture: P.recommendationFallbackHold },
  ];
  for (const c of fallbacks) {
    it(`matches the Python consecutive_success fallback (${c.name})`, () => {
      const expected = c.fixture.payload;
      const result = recommendSlot(toRecords(c.fixture.records));
      expect(result).not.toBeNull();
      if (result === null) return;
      expect(String(result.method)).toBe(expected.method);
      expect(result.shouldIncrement).toBe(expected.shouldIncrement);
      expectClose(result.currentWeight, expected.currentWeight, 6);
      expectClose(result.recommendedWeight, expected.recommendedWeight, 6);
      expectClose(result.confidence, expected.confidence, 6);
    });
  }
});
