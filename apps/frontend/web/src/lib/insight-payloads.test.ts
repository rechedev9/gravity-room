import { describe, expect, it } from 'vitest';
import {
  isFrequencyPayload,
  isPlateauPayload,
  isRecommendationPayload,
  isVolumeTrendPayload,
} from './insight-payloads';

describe('insight payload guards', () => {
  it('requires all frequency fields used by the UI', () => {
    expect(
      isFrequencyPayload({
        sessionsPerWeek: 3,
        currentStreak: 2,
        consistencyPct: 80,
      })
    ).toBe(false);
    expect(
      isFrequencyPayload({
        sessionsPerWeek: 3,
        currentStreak: 2,
        consistencyPct: 80,
        totalSessions: 12,
        workoutDates: ['2026-07-25'],
      })
    ).toBe(true);
  });

  it('rejects volume arrays that cannot form aligned finite chart points', () => {
    expect(
      isVolumeTrendPayload({
        weeks: ['2026-W28', '2026-W29'],
        volumes: [1200],
        slope: 10,
        direction: 'up',
      })
    ).toBe(false);
    expect(
      isVolumeTrendPayload({
        weeks: ['2026-W28'],
        volumes: [Number.NaN],
        slope: 10,
        direction: 'sideways',
      })
    ).toBe(false);
  });

  it('rejects incomplete plateau payloads and out-of-range confidence', () => {
    expect(
      isPlateauPayload({
        isPlateauing: true,
        confidence: 1.2,
        currentWeight: 100,
        weeksAnalyzed: 8,
      })
    ).toBe(false);
  });

  it('requires a supported recommendation method', () => {
    expect(
      isRecommendationPayload({
        currentWeight: 100,
        recommendedWeight: 102.5,
        shouldIncrement: true,
        confidence: 0.8,
        method: 'unknown_model',
      })
    ).toBe(false);
  });
});
