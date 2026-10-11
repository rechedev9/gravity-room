import { describe, expect, it } from 'vitest';
import { buildInsightSeriesKey, parseInsightSeriesKey } from './insight-series';

describe('insight series key', () => {
  it('is the bare exercise id when the lift has a single tier', () => {
    expect(buildInsightSeriesKey({ exerciseId: 'squat', tier: null })).toBe('squat');
  });

  it('appends the tier when the lift has several', () => {
    expect(buildInsightSeriesKey({ exerciseId: 'squat', tier: 't2' })).toBe('squat:t2');
  });

  it('round-trips through parse', () => {
    expect(parseInsightSeriesKey('squat:t1')).toEqual({ exerciseId: 'squat', tier: 't1' });
    expect(parseInsightSeriesKey('squat')).toEqual({ exerciseId: 'squat', tier: null });
  });

  it('keeps a tier that contains the separator parseable', () => {
    const key = buildInsightSeriesKey({ exerciseId: 'squat', tier: 'a:b' });
    expect(parseInsightSeriesKey(key)).toEqual({ exerciseId: 'squat', tier: 'a-b' });
  });

  it('fills the column exactly without cutting the tier', () => {
    const exerciseId = 'x'.repeat(97);
    expect(buildInsightSeriesKey({ exerciseId, tier: 't1' })).toBe(`${exerciseId}:t1`);
  });

  it('refuses a key that does not fit the column instead of colliding two tiers', () => {
    const exerciseId = 'x'.repeat(98);
    expect(() => buildInsightSeriesKey({ exerciseId, tier: 't1' })).toThrow(RangeError);
    expect(() => buildInsightSeriesKey({ exerciseId, tier: 't2' })).toThrow(RangeError);
    expect(() => buildInsightSeriesKey({ exerciseId: 'x'.repeat(101), tier: null })).toThrow(
      RangeError
    );
  });

  it('refuses an exercise id that would read as another lift and tier', () => {
    expect(() => buildInsightSeriesKey({ exerciseId: 'squat:t1', tier: null })).toThrow(RangeError);
  });
});
