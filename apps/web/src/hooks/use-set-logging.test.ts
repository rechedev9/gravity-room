import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useSetLogging } from './use-set-logging';
import type { GenericWorkoutRow, SetLogEntry } from '@gzclp/shared/types';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { GZCLP_DEFINITION_FIXTURE } from '../../test/helpers/fixtures';

// ---------------------------------------------------------------------------
// useSetLogging — unit tests (REQ-SLH-001, REQ-SLH-002, REQ-SLH-003, REQ-SLH-004)
// ---------------------------------------------------------------------------

/**
 * Build a minimal GenericWorkoutRow[] for a single workout (index 0)
 * with one slot (d1-t1: squat T1, 5x3).
 */
function buildRows(overrides?: {
  slotId?: string;
  sets?: number;
  reps?: number;
}): readonly GenericWorkoutRow[] {
  const slotId = overrides?.slotId ?? 'd1-t1';
  const sets = overrides?.sets ?? 5;
  const reps = overrides?.reps ?? 3;

  return [
    {
      index: 0,
      dayName: 'Día 1',
      isChanged: false,
      completedAt: undefined,
      slots: [
        {
          slotId,
          exerciseId: 'squat',
          exerciseName: 'Sentadilla',
          tier: 't1',
          weight: 60,
          stage: 0,
          sets,
          reps,
          repsMax: undefined,
          isAmrap: true,
          stagesCount: 3,
          result: undefined,
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
        },
      ],
    },
  ];
}

type MarkResultFn = (
  index: number,
  slotId: string,
  value: 'success' | 'fail',
  setLogs?: readonly SetLogEntry[]
) => void;

describe('useSetLogging — extended logSet', () => {
  let markResult: ReturnType<typeof mock<MarkResultFn>>;
  let definition: ProgramDefinition;

  beforeEach(() => {
    markResult = mock<MarkResultFn>();
    definition = GZCLP_DEFINITION_FIXTURE;
  });

  // -----------------------------------------------------------------------
  // (a) logSet with weight and rpe produces SetLogEntry with all three fields
  // -----------------------------------------------------------------------

  it('produces SetLogEntry with reps, weight, and rpe when all provided', () => {
    const rows = buildRows({ sets: 3, reps: 5 });
    const { result } = renderHook(() => useSetLogging(markResult, rows, definition));

    act(() => {
      result.current.logSet(0, 'd1-t1', 0, 5, 62.5, 8);
    });

    const logs = result.current.getSetLogs(0, 'd1-t1');
    expect(logs).toBeDefined();
    expect(logs![0]).toEqual({ reps: 5, weight: 62.5, rpe: 8 });
  });

  // -----------------------------------------------------------------------
  // (b) logSet without weight/rpe produces entry with only reps (backwards-compat)
  // -----------------------------------------------------------------------

  it('produces SetLogEntry with only reps when weight and rpe omitted', () => {
    const rows = buildRows({ sets: 3, reps: 5 });
    const { result } = renderHook(() => useSetLogging(markResult, rows, definition));

    act(() => {
      result.current.logSet(0, 'd1-t1', 0, 5);
    });

    const logs = result.current.getSetLogs(0, 'd1-t1');
    expect(logs).toBeDefined();
    expect(logs![0]).toEqual({ reps: 5 });
    expect('weight' in logs![0]).toBe(false);
    expect('rpe' in logs![0]).toBe(false);
  });

  // -----------------------------------------------------------------------
  // (c) logSet with weight only produces entry with reps and weight, no rpe
  // -----------------------------------------------------------------------

  it('produces SetLogEntry with reps and weight when only weight provided', () => {
    const rows = buildRows({ sets: 3, reps: 5 });
    const { result } = renderHook(() => useSetLogging(markResult, rows, definition));

    act(() => {
      result.current.logSet(0, 'd1-t1', 0, 5, 65);
    });

    const logs = result.current.getSetLogs(0, 'd1-t1');
    expect(logs).toBeDefined();
    expect(logs![0]).toEqual({ reps: 5, weight: 65 });
    expect('rpe' in logs![0]).toBe(false);
  });

  // -----------------------------------------------------------------------
  // (d) auto-derive fires with full setLogs including weight/rpe
  // -----------------------------------------------------------------------

  it('auto-derives and calls markResult with setLogs containing weight/rpe', async () => {
    // Use 3 sets to keep test compact. The slot definition for d1-t1 has 5x3 at stage 0,
    // so we build rows with 3 sets to trigger derive after 3 sets logged.
    const rows = buildRows({ sets: 3, reps: 3 });
    const { result } = renderHook(() => useSetLogging(markResult, rows, definition));

    act(() => {
      result.current.logSet(0, 'd1-t1', 0, 3, 60, 7);
      result.current.logSet(0, 'd1-t1', 1, 3, 60, 7.5);
      result.current.logSet(0, 'd1-t1', 2, 3, 60, 8);
    });

    // queueMicrotask is used for markResult — flush it
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(markResult).toHaveBeenCalledTimes(1);

    const [callIndex, callSlotId, callResult, callSetLogs] = markResult.mock.calls[0];
    expect(callIndex).toBe(0);
    expect(callSlotId).toBe('d1-t1');
    expect(callResult).toBe('success');

    // Verify setLogs passed to markResult contain weight and rpe
    expect(callSetLogs).toHaveLength(3);
    expect(callSetLogs![0]).toEqual({ reps: 3, weight: 60, rpe: 7 });
    expect(callSetLogs![1]).toEqual({ reps: 3, weight: 60, rpe: 7.5 });
    expect(callSetLogs![2]).toEqual({ reps: 3, weight: 60, rpe: 8 });

    // Local logs should be cleared after derive
    expect(result.current.getSetLogs(0, 'd1-t1')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // (e) derive logic unchanged — below-target reps still fails regardless of weight
  // -----------------------------------------------------------------------

  it('derives fail when reps below target regardless of weight provided', async () => {
    const rows = buildRows({ sets: 3, reps: 3 });
    const { result } = renderHook(() => useSetLogging(markResult, rows, definition));

    act(() => {
      // Set 0: meets target
      result.current.logSet(0, 'd1-t1', 0, 3, 60, 6);
      // Set 1: below target (2 < 3)
      result.current.logSet(0, 'd1-t1', 1, 2, 60, 9);
      // Set 2: meets target
      result.current.logSet(0, 'd1-t1', 2, 3, 60, 7);
    });

    // Flush queueMicrotask
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(markResult).toHaveBeenCalledTimes(1);

    const [, , callResult] = markResult.mock.calls[0];
    expect(callResult).toBe('fail');
  });
});
