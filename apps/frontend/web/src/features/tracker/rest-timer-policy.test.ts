import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REST_SECONDS,
  plannedConfirmableSets,
  restSecondsForRole,
} from './rest-timer-policy';

describe('restSecondsForRole', () => {
  it('gives primary lifts the longest default rest', () => {
    expect(restSecondsForRole('primary')).toBe(180);
  });

  it('gives secondary lifts a medium rest', () => {
    expect(restSecondsForRole('secondary')).toBe(120);
  });

  it('falls back to the default for accessories and unknown roles', () => {
    expect(restSecondsForRole('accessory')).toBe(DEFAULT_REST_SECONDS);
    expect(restSecondsForRole(undefined)).toBe(DEFAULT_REST_SECONDS);
    expect(restSecondsForRole('gpp')).toBe(DEFAULT_REST_SECONDS);
  });
});

describe('plannedConfirmableSets', () => {
  it('uses slot.sets for standard (non-prescription) slots', () => {
    expect(plannedConfirmableSets({ sets: 5 })).toBe(5);
  });

  it('sums every prescription group so warm-ups count as confirmable rows', () => {
    expect(
      plannedConfirmableSets({
        sets: 3,
        prescriptions: [{ sets: 2 }, { sets: 1 }, { sets: 3 }],
      })
    ).toBe(6);
  });
});
