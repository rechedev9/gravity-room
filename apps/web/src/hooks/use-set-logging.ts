import { useCallback, useRef, useState } from 'react';
import {
  deriveResultFromSetLogs,
  deriveResultFromSetLogsSimple,
} from '@gzclp/shared/generic-engine';
import type { GenericWorkoutRow, ResultValue, SetLogEntry } from '@gzclp/shared/types';
import type { ProgramDefinition } from '@gzclp/shared/types/program';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSetLoggingReturn {
  /** Log reps for a specific set within a slot. */
  readonly logSet: (workoutIndex: number, slotId: string, setIndex: number, reps: number) => void;
  /** Clear in-progress set logs for a slot (used on undo). */
  readonly clearSetLogs: (workoutIndex: number, slotId: string) => void;
  /** Get current in-progress set logs for a slot. */
  readonly getSetLogs: (workoutIndex: number, slotId: string) => readonly SetLogEntry[] | undefined;
  /** Check if set logging is in progress for a slot. */
  readonly isLogging: (workoutIndex: number, slotId: string) => boolean;
  /** Check if all sets for a slot are logged. */
  readonly isSlotComplete: (workoutIndex: number, slotId: string, totalSets: number) => boolean;
}

type MarkResultFn = (
  index: number,
  slotId: string,
  value: ResultValue,
  setLogs?: readonly SetLogEntry[]
) => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Composite key for workoutIndex + slotId. */
function slotKey(workoutIndex: number, slotId: string): string {
  return `${workoutIndex}:${slotId}`;
}

/** Find a slot definition from the program definition by slot ID. */
function findSlotDef(
  definition: ProgramDefinition,
  workoutIndex: number,
  slotId: string
): ProgramDefinition['days'][number]['slots'][number] | undefined {
  const cycleLength = definition.days.length;
  const day = definition.days[workoutIndex % cycleLength];
  return day.slots.find((s) => s.id === slotId);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSetLogging(
  markResult: MarkResultFn,
  rows: readonly GenericWorkoutRow[],
  definition: ProgramDefinition | undefined
): UseSetLoggingReturn {
  // Local state: partial set logs keyed by "workoutIndex:slotId"
  const [logsMap, setLogsMap] = useState<ReadonlyMap<string, readonly SetLogEntry[]>>(new Map());

  // Ref to avoid stale closure over markResult
  const markResultRef = useRef(markResult);
  markResultRef.current = markResult;

  const logSet = useCallback(
    (workoutIndex: number, slotId: string, setIndex: number, reps: number): void => {
      setLogsMap((prev) => {
        const key = slotKey(workoutIndex, slotId);
        const existing = prev.get(key) ?? [];
        const updated = [...existing];

        // Fill gaps with undefined-like entries if setIndex is beyond current length
        while (updated.length < setIndex) {
          updated.push({ reps: 0 });
        }

        // Set or overwrite the specific set index
        updated[setIndex] = { reps };

        const next = new Map(prev);
        next.set(key, updated);

        // Check if all sets are logged — auto-derive result
        const row = rows[workoutIndex];
        const slot = row?.slots.find((s) => s.slotId === slotId);
        if (slot && updated.length >= slot.sets) {
          // All sets logged — derive result and submit
          const derivedResult = deriveResult(updated, slot, definition, workoutIndex, slotId);

          // Schedule markResult outside setState to avoid calling setState during render
          queueMicrotask(() => {
            markResultRef.current(workoutIndex, slotId, derivedResult, updated);
          });

          // Clear local logs — result is now committed
          next.delete(key);
        }

        return next;
      });
    },
    [rows, definition]
  );

  const clearSetLogs = useCallback((workoutIndex: number, slotId: string): void => {
    setLogsMap((prev) => {
      const key = slotKey(workoutIndex, slotId);
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const getSetLogs = useCallback(
    (workoutIndex: number, slotId: string): readonly SetLogEntry[] | undefined => {
      return logsMap.get(slotKey(workoutIndex, slotId));
    },
    [logsMap]
  );

  const isLogging = useCallback(
    (workoutIndex: number, slotId: string): boolean => {
      return logsMap.has(slotKey(workoutIndex, slotId));
    },
    [logsMap]
  );

  const isSlotComplete = useCallback(
    (workoutIndex: number, slotId: string, totalSets: number): boolean => {
      const logs = logsMap.get(slotKey(workoutIndex, slotId));
      return logs !== undefined && logs.length >= totalSets;
    },
    [logsMap]
  );

  return { logSet, clearSetLogs, getSetLogs, isLogging, isSlotComplete };
}

// ---------------------------------------------------------------------------
// Result derivation
// ---------------------------------------------------------------------------

function deriveResult(
  setLogs: readonly SetLogEntry[],
  slot: { readonly sets: number; readonly reps: number },
  definition: ProgramDefinition | undefined,
  workoutIndex: number,
  slotId: string
): ResultValue {
  if (definition === undefined) {
    return deriveResultFromSetLogsSimple(setLogs, slot.reps) ?? 'success';
  }

  const slotDef = findSlotDef(definition, workoutIndex, slotId);
  if (slotDef === undefined) {
    return deriveResultFromSetLogsSimple(setLogs, slot.reps) ?? 'success';
  }

  if (slotDef.onSuccess.type === 'double_progression') {
    return deriveResultFromSetLogs(setLogs, slotDef.onSuccess) ?? 'success';
  }

  return deriveResultFromSetLogsSimple(setLogs, slot.reps) ?? 'success';
}
