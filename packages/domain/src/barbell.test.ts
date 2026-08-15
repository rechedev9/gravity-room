import { describe, expect, it } from 'vitest';

import { computePlateLoading, estimateRepMaxFromOneRM } from './barbell';

describe('computePlateLoading', () => {
  it.each([
    { target: 20, expected: [] as readonly (readonly [number, number])[], remainder: 0 },
    { target: 60, expected: [[20, 1]] as const, remainder: 0 },
    {
      target: 100,
      expected: [
        [25, 1],
        [15, 1],
      ] as const,
      remainder: 0,
    },
    {
      target: 72.5,
      expected: [
        [25, 1],
        [1.25, 1],
      ] as const,
      remainder: 0,
    },
    {
      target: 47.5,
      expected: [
        [10, 1],
        [2.5, 1],
        [1.25, 1],
      ] as const,
      remainder: 0,
    },
  ])('loads $target kg heaviest-first', ({ target, expected, remainder }) => {
    const loading = computePlateLoading(target);
    expect(loading?.perSide.map((g) => [g.plate, g.count])).toEqual(
      expected.map(([p, c]) => [p, c])
    );
    expect(loading?.remainder).toBe(remainder);
    expect(loading?.achievedWeight).toBe(target);
  });

  it('reports the remainder when the plate set cannot express the target', () => {
    const loading = computePlateLoading(21, 20, [25]);
    expect(loading?.perSide).toEqual([]);
    expect(loading?.achievedWeight).toBe(20);
    expect(loading?.remainder).toBe(1);
  });

  it('honours a non-standard bar', () => {
    const loading = computePlateLoading(55, 15);
    expect(loading?.barWeight).toBe(15);
    expect(loading?.perSide.map((g) => [g.plate, g.count])).toEqual([[20, 1]]);
  });

  it.each([
    { name: 'target below the bar', target: 15, bar: 20 },
    { name: 'non-finite target', target: Number.NaN, bar: 20 },
  ])('returns null for $name', ({ target, bar }) => {
    expect(computePlateLoading(target, bar)).toBeNull();
  });
});

describe('estimateRepMaxFromOneRM', () => {
  it.each([
    { oneRepMax: 180, reps: 5, expected: 155 },
    { oneRepMax: 100, reps: 1, expected: 97.5 },
    { oneRepMax: 120, reps: 10, expected: 90 },
    { oneRepMax: 0, reps: 5, expected: 0 },
    { oneRepMax: 100, reps: 0, expected: 0 },
    { oneRepMax: -10, reps: 5, expected: 0 },
  ])('maps $oneRepMax kg 1RM at $reps reps to $expected kg', ({ oneRepMax, reps, expected }) => {
    expect(estimateRepMaxFromOneRM(oneRepMax, reps)).toBe(expected);
  });

  it('respects a custom rounding step', () => {
    expect(estimateRepMaxFromOneRM(180, 5, 5)).toBe(155);
    expect(estimateRepMaxFromOneRM(180, 5, 1)).toBe(154);
  });
});
