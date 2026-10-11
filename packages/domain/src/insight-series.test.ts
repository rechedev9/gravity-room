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

  it('keeps a tier that contains the separator parseable and the key within the column', () => {
    const key = buildInsightSeriesKey({ exerciseId: 'squat', tier: `a:b${'x'.repeat(200)}` });
    expect(key.length).toBeLessThanOrEqual(100);
    expect(parseInsightSeriesKey(key).exerciseId).toBe('squat');
  });
});
