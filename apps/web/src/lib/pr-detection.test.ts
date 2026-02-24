import { describe, it, expect } from 'bun:test';
import { detectT1PersonalRecord, detectGenericPersonalRecord } from './pr-detection';
import type { WorkoutRow, GenericWorkoutRow, GenericSlotRow } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Helpers — minimal row factories
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<WorkoutRow> & { index: number }): WorkoutRow {
  return {
    dayName: 'A1',
    t1Exercise: 'squat',
    t1Weight: 60,
    t1Stage: 0,
    t1Sets: 5,
    t1Reps: 3,
    t2Exercise: 'bench',
    t2Weight: 40,
    t2Stage: 0,
    t2Sets: 3,
    t2Reps: 10,
    t3Exercise: 'latpulldown',
    t3Weight: 30,
    isChanged: false,
    result: {},
    ...overrides,
  };
}

function makeGenericRow(index: number, slots: Partial<GenericSlotRow>[]): GenericWorkoutRow {
  return {
    index,
    dayName: `Day ${index + 1}`,
    isChanged: false,
    slots: slots.map((s, i) => ({
      slotId: s.slotId ?? `slot-${i}`,
      exerciseId: s.exerciseId ?? 'squat',
      exerciseName: s.exerciseName ?? 'Squat',
      tier: s.tier ?? 't1',
      weight: s.weight ?? 60,
      stage: s.stage ?? 0,
      sets: s.sets ?? 5,
      reps: s.reps ?? 3,
      repsMax: s.repsMax,
      isAmrap: s.isAmrap ?? false,
      result: s.result,
      amrapReps: s.amrapReps,
      rpe: s.rpe,
      isChanged: s.isChanged ?? false,
      role: s.role ?? 'primary',
    })),
  };
}

// ---------------------------------------------------------------------------
// detectT1PersonalRecord
// ---------------------------------------------------------------------------

describe('detectT1PersonalRecord', () => {
  it('returns false for T2 tier', () => {
    const rows = [makeRow({ index: 0, result: { t2: 'success' } })];
    expect(detectT1PersonalRecord(rows, 0, 't2', 'success')).toBe(false);
  });

  it('returns false for T3 tier', () => {
    const rows = [makeRow({ index: 0, result: { t3: 'success' } })];
    expect(detectT1PersonalRecord(rows, 0, 't3', 'success')).toBe(false);
  });

  it('returns false for fail result', () => {
    const rows = [
      makeRow({ index: 0, result: { t1: 'success' } }),
      makeRow({ index: 1, t1Weight: 65, result: { t1: 'fail' } }),
    ];
    expect(detectT1PersonalRecord(rows, 1, 't1', 'fail')).toBe(false);
  });

  it('returns false at index 0 (no prior success to beat)', () => {
    const rows = [makeRow({ index: 0, t1Weight: 60, result: { t1: 'success' } })];
    expect(detectT1PersonalRecord(rows, 0, 't1', 'success')).toBe(false);
  });

  it('returns false when weight equals prior best', () => {
    const rows = [
      makeRow({ index: 0, t1Weight: 60, result: { t1: 'success' } }),
      makeRow({ index: 1, t1Weight: 60, result: { t1: 'success' } }),
    ];
    expect(detectT1PersonalRecord(rows, 1, 't1', 'success')).toBe(false);
  });

  it('returns true when weight strictly exceeds prior best', () => {
    const rows = [
      makeRow({ index: 0, t1Weight: 60, result: { t1: 'success' } }),
      makeRow({ index: 1, t1Weight: 62.5, result: { t1: 'success' } }),
    ];
    expect(detectT1PersonalRecord(rows, 1, 't1', 'success')).toBe(true);
  });

  it('isolates by exercise', () => {
    const rows = [
      makeRow({ index: 0, t1Exercise: 'squat', t1Weight: 100, result: { t1: 'success' } }),
      makeRow({ index: 1, t1Exercise: 'bench', t1Weight: 60, result: { t1: 'success' } }),
      makeRow({ index: 2, t1Exercise: 'bench', t1Weight: 62.5, result: { t1: 'success' } }),
    ];
    // Bench PR detected (62.5 > 60), but squat at index 0 doesn't count
    expect(detectT1PersonalRecord(rows, 2, 't1', 'success')).toBe(true);
  });

  it('returns false when no prior success exists for that exercise', () => {
    const rows = [
      makeRow({ index: 0, t1Exercise: 'squat', t1Weight: 60, result: { t1: 'success' } }),
      makeRow({ index: 1, t1Exercise: 'bench', t1Weight: 40, result: { t1: 'success' } }),
    ];
    // First bench success — no prior bench to beat
    expect(detectT1PersonalRecord(rows, 1, 't1', 'success')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectGenericPersonalRecord
// ---------------------------------------------------------------------------

describe('detectGenericPersonalRecord', () => {
  it('returns false for non-success', () => {
    const rows = [
      makeGenericRow(0, [{ slotId: 's1', tier: 't1', weight: 60, result: 'success' }]),
      makeGenericRow(1, [{ slotId: 's1', tier: 't1', weight: 65, result: 'fail' }]),
    ];
    expect(detectGenericPersonalRecord(rows, 1, 's1', 'fail')).toBe(false);
  });

  it('returns false for T2 slot with secondary role', () => {
    const rows = [
      makeGenericRow(0, [
        { slotId: 's2', tier: 't2', role: 'secondary', weight: 40, result: 'success' },
      ]),
      makeGenericRow(1, [
        { slotId: 's2', tier: 't2', role: 'secondary', weight: 45, result: 'success' },
      ]),
    ];
    expect(detectGenericPersonalRecord(rows, 1, 's2', 'success')).toBe(false);
  });

  it('returns true when exceeding prior T1 best', () => {
    const rows = [
      makeGenericRow(0, [
        { slotId: 's1', tier: 't1', exerciseId: 'squat', weight: 60, result: 'success' },
      ]),
      makeGenericRow(1, [
        { slotId: 's1', tier: 't1', exerciseId: 'squat', weight: 65, result: 'success' },
      ]),
    ];
    expect(detectGenericPersonalRecord(rows, 1, 's1', 'success')).toBe(true);
  });

  it('returns false for first success', () => {
    const rows = [
      makeGenericRow(0, [
        { slotId: 's1', tier: 't1', exerciseId: 'squat', weight: 60, result: 'success' },
      ]),
    ];
    expect(detectGenericPersonalRecord(rows, 0, 's1', 'success')).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Role-based PR detection (REQ-UI-005)
  // ---------------------------------------------------------------------------

  it('detects PR for role: primary slot with higher weight than prior best', () => {
    const rows = [
      makeGenericRow(0, [
        {
          slotId: 's1',
          tier: 'main',
          role: 'primary',
          exerciseId: 'squat',
          weight: 100,
          result: 'success',
        },
      ]),
      makeGenericRow(1, [
        {
          slotId: 's1',
          tier: 'main',
          role: 'primary',
          exerciseId: 'squat',
          weight: 105,
          result: 'success',
        },
      ]),
    ];
    expect(detectGenericPersonalRecord(rows, 1, 's1', 'success')).toBe(true);
  });

  it('does not detect PR for role: secondary slot even with higher weight', () => {
    const rows = [
      makeGenericRow(0, [
        {
          slotId: 's1',
          tier: 'secondary',
          role: 'secondary',
          exerciseId: 'squat',
          weight: 80,
          result: 'success',
        },
      ]),
      makeGenericRow(1, [
        {
          slotId: 's1',
          tier: 'secondary',
          role: 'secondary',
          exerciseId: 'squat',
          weight: 85,
          result: 'success',
        },
      ]),
    ];
    expect(detectGenericPersonalRecord(rows, 1, 's1', 'success')).toBe(false);
  });

  it('detects PR for GZCLP T1 slot with synthesized role: primary', () => {
    const rows = [
      makeGenericRow(0, [
        {
          slotId: 's1',
          tier: 't1',
          role: 'primary',
          exerciseId: 'squat',
          weight: 100,
          result: 'success',
        },
      ]),
      makeGenericRow(1, [
        {
          slotId: 's1',
          tier: 't1',
          role: 'primary',
          exerciseId: 'squat',
          weight: 102.5,
          result: 'success',
        },
      ]),
    ];
    expect(detectGenericPersonalRecord(rows, 1, 's1', 'success')).toBe(true);
  });
});
