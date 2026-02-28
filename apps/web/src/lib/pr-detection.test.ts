import { describe, it, expect } from 'bun:test';
import { detectGenericPersonalRecord } from './pr-detection';
import type { GenericWorkoutRow, GenericSlotRow } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Helpers — minimal row factories
// ---------------------------------------------------------------------------

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
      stagesCount: s.stagesCount ?? 1,
      result: s.result,
      amrapReps: s.amrapReps,
      rpe: s.rpe,
      isChanged: s.isChanged ?? false,
      isDeload: s.isDeload ?? false,
      role: s.role ?? 'primary',
      notes: s.notes ?? undefined,
    })),
  };
}

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
