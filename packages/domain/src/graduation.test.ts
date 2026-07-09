import { describe, expect, it } from 'vitest';

import { computeEpley1RM } from './graduation';

describe('computeEpley1RM', () => {
  it('applies the Epley formula: weight * (1 + reps / 30)', () => {
    expect(computeEpley1RM(100, 5)).toBeCloseTo(116.6666667, 5);
    expect(computeEpley1RM(60, 1)).toBeCloseTo(62, 5);
    expect(computeEpley1RM(80, 10)).toBeCloseTo(106.6666667, 5);
  });

  it('returns 0 for non-positive weight or reps', () => {
    expect(computeEpley1RM(0, 5)).toBe(0);
    expect(computeEpley1RM(-10, 5)).toBe(0);
    expect(computeEpley1RM(100, 0)).toBe(0);
    expect(computeEpley1RM(100, -1)).toBe(0);
  });
});
