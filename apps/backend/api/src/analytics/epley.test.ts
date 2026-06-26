import { describe, it, expect } from 'bun:test';
import { epley } from './epley';
import golden from './__fixtures__/golden.json';

describe('epley', () => {
  for (const c of golden.epley) {
    it(`epley(${c.weight}, ${c.reps}) = ${c.e1rm}`, () => {
      expect(epley(c.weight, c.reps)).toBeCloseTo(c.e1rm, 12);
    });
  }

  it('returns the weight unchanged for a single rep', () => {
    // Distinct from @gzclp/domain computeEpley1RM, which would return 103.33.
    expect(epley(100, 1)).toBe(100);
    expect(epley(142.5, 1)).toBe(142.5);
  });

  it('applies w * (1 + reps/30) for reps > 1', () => {
    expect(epley(100, 5)).toBeCloseTo(116.6666666667, 9);
    expect(epley(60, 3)).toBeCloseTo(66, 9);
  });

  it('is zero when weight is zero', () => {
    expect(epley(0, 5)).toBe(0);
  });
});
