/**
 * Unit tests for pyRound — faithful CPython round() parity.
 *
 * The four headline cases are the ones a naive binary-scaled rounder gets wrong:
 * their nearest double sits just under (or just over) the apparent decimal half,
 * so correct rounding of the TRUE value diverges from a `Math.round(x*10**n)`
 * implementation. Values verified against CPython 3 `round(x, n)`.
 */
import { describe, it, expect } from 'bun:test';
import { pyRound } from './round';

describe('pyRound', () => {
  it('matches CPython on the binary-tie divergence cases', () => {
    // Values verified against CPython 3 `round(x, n)`. The nearest double to each
    // literal sits just off the apparent decimal half, so correct rounding of the
    // TRUE value diverges from a naive binary-scaled rounder:
    //   2.675  -> 2.6749999999999998… -> 2.67
    //   116.65 -> 116.6500000000000056… -> 116.7
    //   107.915 -> 107.9150000000000062… -> 107.92  (above the half, rounds up)
    //   2.665  -> 2.6650000000000000355… -> 2.67
    expect(pyRound(2.675, 2)).toBe(2.67);
    expect(pyRound(116.65, 1)).toBe(116.7);
    expect(pyRound(107.915, 2)).toBe(107.92);
    expect(pyRound(2.665, 2)).toBe(2.67);
  });

  it('rounds ordinary non-tie values to nearest', () => {
    expect(pyRound(1.234, 2)).toBe(1.23);
    expect(pyRound(1.236, 2)).toBe(1.24);
    expect(pyRound(9.999, 2)).toBe(10);
    expect(pyRound(0.1, 1)).toBe(0.1);
  });

  it('breaks exact halves to even (banker’s rounding)', () => {
    expect(pyRound(0.5, 0)).toBe(0);
    expect(pyRound(1.5, 0)).toBe(2);
    expect(pyRound(2.5, 0)).toBe(2);
    expect(pyRound(0.125, 2)).toBe(0.12);
    expect(pyRound(0.375, 2)).toBe(0.38);
  });

  it('is symmetric for negative values', () => {
    expect(pyRound(-2.675, 2)).toBe(-2.67);
    expect(pyRound(-2.5, 0)).toBe(-2);
    expect(pyRound(-1.5, 0)).toBe(-2);
  });

  it('passes non-finite values through unchanged', () => {
    expect(pyRound(Number.NaN, 2)).toBeNaN();
    expect(pyRound(Number.POSITIVE_INFINITY, 2)).toBe(Number.POSITIVE_INFINITY);
  });
});
