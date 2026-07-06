import { describe, it, expect } from 'vitest';
import {
  isFrequencyPayload,
  isVolumeTrendPayload,
  isPlateauPayload,
  isRecommendationPayload,
} from './insight-payloads';

// ---------------------------------------------------------------------------
// insight-payloads — runtime type guards
// ---------------------------------------------------------------------------

const nonObjects: readonly unknown[] = [null, undefined, 0, 42, 'payload', true, false];

describe('isFrequencyPayload', () => {
  const valid = {
    sessionsPerWeek: 3.5,
    currentStreak: 4,
    consistencyPct: 87,
    totalSessions: 42,
    workoutDates: ['2026-01-01'],
  };

  it('accepts a fully-populated payload', () => {
    expect(isFrequencyPayload(valid)).toBe(true);
  });

  it('accepts a payload without the optional fields', () => {
    expect(isFrequencyPayload({ sessionsPerWeek: 2, currentStreak: 0, consistencyPct: 50 })).toBe(
      true
    );
  });

  it('rejects when a required field is missing', () => {
    expect(isFrequencyPayload({ sessionsPerWeek: 2, currentStreak: 0 })).toBe(false);
    expect(isFrequencyPayload({ sessionsPerWeek: 2, consistencyPct: 50 })).toBe(false);
    expect(isFrequencyPayload({ currentStreak: 0, consistencyPct: 50 })).toBe(false);
  });

  it('rejects when a required field has the wrong type', () => {
    expect(isFrequencyPayload({ ...valid, sessionsPerWeek: '3.5' })).toBe(false);
    expect(isFrequencyPayload({ ...valid, currentStreak: null })).toBe(false);
    expect(isFrequencyPayload({ ...valid, consistencyPct: undefined })).toBe(false);
  });

  it('rejects null, undefined and primitives', () => {
    for (const value of nonObjects) {
      expect(isFrequencyPayload(value)).toBe(false);
    }
  });

  it('rejects an empty object and an array', () => {
    expect(isFrequencyPayload({})).toBe(false);
    expect(isFrequencyPayload([valid])).toBe(false);
  });
});

describe('isVolumeTrendPayload', () => {
  const valid = {
    weeks: ['2026-W01', '2026-W02'],
    volumes: [1000, 1200],
    slope: 200,
    direction: 'up',
  };

  it('accepts a fully-populated payload', () => {
    expect(isVolumeTrendPayload(valid)).toBe(true);
  });

  it('accepts empty arrays for weeks/volumes', () => {
    expect(isVolumeTrendPayload({ weeks: [], volumes: [], direction: 'flat' })).toBe(true);
  });

  it('rejects when a required field is missing', () => {
    expect(isVolumeTrendPayload({ weeks: [], volumes: [] })).toBe(false);
    expect(isVolumeTrendPayload({ weeks: [], direction: 'flat' })).toBe(false);
    expect(isVolumeTrendPayload({ volumes: [], direction: 'flat' })).toBe(false);
  });

  it('rejects when a required field has the wrong type', () => {
    expect(isVolumeTrendPayload({ ...valid, weeks: 'not-an-array' })).toBe(false);
    expect(isVolumeTrendPayload({ ...valid, volumes: 1200 })).toBe(false);
    expect(isVolumeTrendPayload({ ...valid, direction: 1 })).toBe(false);
  });

  it('rejects null, undefined and primitives', () => {
    for (const value of nonObjects) {
      expect(isVolumeTrendPayload(value)).toBe(false);
    }
  });

  it('rejects an empty object', () => {
    expect(isVolumeTrendPayload({})).toBe(false);
  });
});

describe('isPlateauPayload', () => {
  const valid = {
    isPlateauing: true,
    confidence: 0.8,
    slope: -0.1,
    currentWeight: 100,
    weeksAnalyzed: 6,
  };

  it('accepts a fully-populated payload', () => {
    expect(isPlateauPayload(valid)).toBe(true);
  });

  it('rejects when a required field is missing', () => {
    expect(isPlateauPayload({ confidence: 0.8, currentWeight: 100, weeksAnalyzed: 6 })).toBe(false);
    expect(isPlateauPayload({ isPlateauing: true, currentWeight: 100, weeksAnalyzed: 6 })).toBe(
      false
    );
    expect(isPlateauPayload({ isPlateauing: true, confidence: 0.8, weeksAnalyzed: 6 })).toBe(false);
    expect(isPlateauPayload({ isPlateauing: true, confidence: 0.8, currentWeight: 100 })).toBe(
      false
    );
  });

  it('rejects when a required field has the wrong type', () => {
    expect(isPlateauPayload({ ...valid, isPlateauing: 'yes' })).toBe(false);
    expect(isPlateauPayload({ ...valid, confidence: '0.8' })).toBe(false);
    expect(isPlateauPayload({ ...valid, currentWeight: null })).toBe(false);
    expect(isPlateauPayload({ ...valid, weeksAnalyzed: undefined })).toBe(false);
  });

  it('rejects null, undefined and primitives', () => {
    for (const value of nonObjects) {
      expect(isPlateauPayload(value)).toBe(false);
    }
  });

  it('rejects an empty object', () => {
    expect(isPlateauPayload({})).toBe(false);
  });
});

describe('isRecommendationPayload', () => {
  const valid = {
    currentWeight: 100,
    recommendedWeight: 102.5,
    shouldIncrement: true,
    confidence: 0.9,
    method: 'logistic_regression',
  };

  it('accepts a fully-populated payload', () => {
    expect(isRecommendationPayload(valid)).toBe(true);
  });

  it('rejects when a required field is missing', () => {
    expect(
      isRecommendationPayload({ recommendedWeight: 102.5, shouldIncrement: true, confidence: 0.9 })
    ).toBe(false);
    expect(
      isRecommendationPayload({ currentWeight: 100, shouldIncrement: true, confidence: 0.9 })
    ).toBe(false);
    expect(
      isRecommendationPayload({ currentWeight: 100, recommendedWeight: 102.5, confidence: 0.9 })
    ).toBe(false);
    expect(
      isRecommendationPayload({
        currentWeight: 100,
        recommendedWeight: 102.5,
        shouldIncrement: true,
      })
    ).toBe(false);
  });

  it('rejects when a required field has the wrong type', () => {
    expect(isRecommendationPayload({ ...valid, currentWeight: '100' })).toBe(false);
    expect(isRecommendationPayload({ ...valid, recommendedWeight: null })).toBe(false);
    expect(isRecommendationPayload({ ...valid, shouldIncrement: 1 })).toBe(false);
    expect(isRecommendationPayload({ ...valid, confidence: 'high' })).toBe(false);
  });

  it('rejects null, undefined and primitives', () => {
    for (const value of nonObjects) {
      expect(isRecommendationPayload(value)).toBe(false);
    }
  });

  it('rejects an empty object', () => {
    expect(isRecommendationPayload({})).toBe(false);
  });
});
