import { describe, expect, it } from 'vitest';
import { insightSeriesLabel } from './insight-series-label';

describe('insightSeriesLabel', () => {
  it('shows the tier only when the lift has one in its key', () => {
    expect(insightSeriesLabel('squat')).toBe('squat');
    expect(insightSeriesLabel('squat:t2')).toBe('squat T2');
  });
});
