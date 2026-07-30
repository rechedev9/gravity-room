import { describe, expect, it } from 'vitest';
import {
  maxProjectedIndex,
  PROJECTION_HORIZON_WHEN_SPARSE,
  PROJECTION_MIN_REAL_FOR_FULL,
} from './line-chart';

describe('maxProjectedIndex', () => {
  it('returns -1 when there is no real data', () => {
    expect(maxProjectedIndex(-1, 90)).toBe(-1);
  });

  it('caps projection when only one real session exists', () => {
    // lastMarkedIdx=0 → 1 real point → horizon of 6 projected steps
    expect(maxProjectedIndex(0, 90)).toBe(PROJECTION_HORIZON_WHEN_SPARSE);
  });

  it('still caps with two real sessions', () => {
    expect(maxProjectedIndex(1, 90)).toBe(1 + PROJECTION_HORIZON_WHEN_SPARSE);
  });

  it('opens the full series once enough real points exist', () => {
    const lastMarked = PROJECTION_MIN_REAL_FOR_FULL - 1; // realCount === MIN
    expect(maxProjectedIndex(lastMarked, 90)).toBe(89);
  });

  it('never exceeds the last data index', () => {
    expect(maxProjectedIndex(0, 4)).toBe(3);
  });
});
