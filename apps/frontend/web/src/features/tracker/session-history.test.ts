import { describe, expect, it } from 'vitest';
import type { GenericSlotRow, GenericWorkoutRow, ResultValue } from '@gzclp/domain/types';
import {
  daysBetween,
  findNextScheduled,
  findPreviousSameDay,
  workoutVolume,
} from './session-history';

function slot(overrides: Partial<GenericSlotRow> = {}): GenericSlotRow {
  return {
    slotId: 'a-t1',
    exerciseId: 'squat',
    exerciseName: 'Squat',
    tier: 't1',
    weight: 100,
    stage: 0,
    sets: 5,
    reps: 3,
    repsMax: undefined,
    isAmrap: true,
    stagesCount: 3,
    result: 'success',
    amrapReps: undefined,
    rpe: undefined,
    isChanged: false,
    isDeload: false,
    role: 'primary',
    notes: undefined,
    prescriptions: undefined,
    isGpp: undefined,
    complexReps: undefined,
    propagatesTo: undefined,
    isTestSlot: undefined,
    isBodyweight: undefined,
    setLogs: undefined,
    ...overrides,
  };
}

function row(index: number, dayName: string, slots: readonly GenericSlotRow[]): GenericWorkoutRow {
  return { index, dayName, slots, isChanged: false, completedAt: undefined };
}

describe('findPreviousSameDay', () => {
  it('returns the latest fully-recorded workout with the same day name', () => {
    const rows = [
      row(0, 'A1', [slot()]),
      row(1, 'B1', [slot({ slotId: 'b-t1' })]),
      row(2, 'A1', [slot({ weight: 105 })]),
      row(3, 'A1', [slot({ weight: 110, result: undefined })]),
    ];

    expect(findPreviousSameDay(rows, 3)?.index).toBe(2);
    expect(findPreviousSameDay(rows, 3)?.lines[0]?.weight).toBe(105);
  });

  it('skips same-day workouts that are still open', () => {
    const rows = [
      row(0, 'A1', [slot()]),
      row(2, 'A1', [slot({ result: undefined })]),
      row(4, 'A1', [slot({ result: undefined })]),
    ];
    expect(findPreviousSameDay(rows, 2)?.index).toBe(0);
  });

  it('returns null when no earlier session of that day exists', () => {
    expect(findPreviousSameDay([row(0, 'A1', [slot()])], 0)).toBeNull();
    expect(findPreviousSameDay([], 0)).toBeNull();
  });

  const summaryCases: ReadonlyArray<{
    readonly name: string;
    readonly overrides: Partial<GenericSlotRow>;
    readonly expected: string;
  }> = [
    {
      name: 'joins per-set logs',
      overrides: { setLogs: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 7 }] },
      expected: '3 3 3 3 7',
    },
    {
      name: 'expands an AMRAP tail when only the final count is known',
      overrides: { amrapReps: 9 },
      expected: '3 3 3 3 9',
    },
    {
      name: 'falls back to the prescribed scheme',
      overrides: {},
      expected: '5×3',
    },
    {
      name: 'prefers complex reps over stage reps in the fallback',
      overrides: { complexReps: '3+3' },
      expected: '5×3+3',
    },
  ];

  it.each(summaryCases)('$name', ({ overrides, expected }) => {
    const rows = [row(0, 'A1', [slot(overrides)]), row(2, 'A1', [slot({ result: undefined })])];
    expect(findPreviousSameDay(rows, 1)?.lines[0]?.repsSummary).toBe(expected);
  });

  it.each([
    { result: 'success' as ResultValue, expected: 'success' },
    { result: 'fail' as ResultValue, expected: 'fail' },
  ])('maps a $result result through', ({ result, expected }) => {
    const rows = [row(0, 'A1', [slot({ result })]), row(2, 'A1', [slot({ result: undefined })])];
    expect(findPreviousSameDay(rows, 1)?.lines[0]?.result).toBe(expected);
  });
});

describe('daysBetween', () => {
  it.each([
    { from: '2026-08-01T10:00:00Z', to: '2026-08-05T10:00:00Z', expected: 4 },
    { from: '2026-08-05T10:00:00Z', to: '2026-08-05T23:00:00Z', expected: 0 },
    { from: '2026-08-09T10:00:00Z', to: '2026-08-05T10:00:00Z', expected: 0 },
    { from: undefined, to: '2026-08-05T10:00:00Z', expected: null },
    { from: '2026-08-05T10:00:00Z', to: undefined, expected: null },
    { from: 'not-a-date', to: '2026-08-05T10:00:00Z', expected: null },
  ])('returns $expected', ({ from, to, expected }) => {
    expect(daysBetween(from, to)).toBe(expected);
  });
});

describe('findNextScheduled', () => {
  it('returns the same slot in the next workout that schedules it', () => {
    const rows = [
      row(0, 'A1', [slot()]),
      row(1, 'B1', [slot({ slotId: 'b-t1' })]),
      row(2, 'A1', [slot({ weight: 105 })]),
    ];
    expect(findNextScheduled(rows, 0, 'a-t1')?.weight).toBe(105);
  });

  it('returns null when the slot is never scheduled again', () => {
    expect(findNextScheduled([row(0, 'A1', [slot()])], 0, 'a-t1')).toBeNull();
    expect(findNextScheduled([row(0, 'A1', [slot()])], 0, 'nope')).toBeNull();
  });
});

describe('workoutVolume', () => {
  it.each([
    {
      name: 'sums logged sets at the slot weight',
      slots: [slot({ setLogs: [{ reps: 3 }, { reps: 3 }, { reps: 5 }] })],
      expected: 1100,
    },
    {
      name: 'expands the prescription when only a slot-level success exists',
      slots: [slot({ sets: 3, reps: 10, isAmrap: false, weight: 50 })],
      expected: 1500,
    },
    {
      name: 'uses the AMRAP tail for the last set',
      slots: [slot({ sets: 3, reps: 10, weight: 50, amrapReps: 14 })],
      expected: 1700,
    },
    {
      name: 'ignores failed and bodyweight slots',
      slots: [slot({ result: 'fail' }), slot({ slotId: 'gpp', weight: 0 })],
      expected: 0,
    },
  ])('$name', ({ slots, expected }) => {
    expect(workoutVolume(row(0, 'A1', slots))).toBe(expected);
  });
});
