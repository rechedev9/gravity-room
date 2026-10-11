import type { GenericResults, GenericUndoHistory } from './types/program';
import type { ResultValue, SetLogEntry } from './types';

/**
 * Pure helpers for immutably mutating GenericResults state.
 * No React, no TanStack Query — safe to call from any context.
 */

export function setSlotResult(
  prev: GenericResults,
  workoutIndex: number,
  slotId: string,
  result: ResultValue,
  amrapReps?: number,
  setLogs?: readonly SetLogEntry[]
): GenericResults {
  const key = String(workoutIndex);
  const existing = prev[key] ?? {};
  return {
    ...prev,
    [key]: {
      ...existing,
      [slotId]: {
        ...existing[slotId],
        result,
        ...(amrapReps !== undefined ? { amrapReps } : {}),
        ...(setLogs !== undefined ? { setLogs: [...setLogs] } : {}),
      },
    },
  };
}

export function removeSlotResult(
  results: GenericResults,
  workoutIndex: number,
  slotId: string
): GenericResults {
  const key = String(workoutIndex);
  const updated = { ...results };
  if (updated[key]) {
    const entry = { ...updated[key] };
    delete entry[slotId];
    if (Object.keys(entry).length === 0) {
      delete updated[key];
    } else {
      updated[key] = entry;
    }
  }
  return updated;
}

export function patchSlotField(
  prev: GenericResults,
  workoutIndex: number,
  slotId: string,
  field: 'amrapReps' | 'rpe',
  value: number | undefined
): GenericResults {
  const key = String(workoutIndex);
  const updatedResults = { ...prev };
  const workoutEntry = { ...updatedResults[key] };
  const slotEntry = { ...workoutEntry[slotId] };
  if (value === undefined) {
    delete slotEntry[field];
  } else {
    slotEntry[field] = value;
  }
  workoutEntry[slotId] = slotEntry;
  updatedResults[key] = workoutEntry;
  return updatedResults;
}

/**
 * Snapshots the slot as it is now, so applying the entry later restores it.
 * A slot with no result yields an entry without `prev`, which undo deletes.
 */
export function buildUndoEntry(
  results: GenericResults,
  workoutIndex: number,
  slotId: string
): GenericUndoHistory[number] {
  const current = results[String(workoutIndex)]?.[slotId];
  return {
    i: workoutIndex,
    slotId,
    ...(current?.result !== undefined ? { prev: current.result } : {}),
    ...(current?.rpe !== undefined ? { prevRpe: current.rpe } : {}),
    ...(current?.amrapReps !== undefined ? { prevAmrapReps: current.amrapReps } : {}),
    ...(current?.setLogs !== undefined ? { prevSetLogs: current.setLogs } : {}),
  };
}

/**
 * Restores the result state to what it was before a single undo-history entry
 * was recorded. Mirrors the server's `undoLast` (apps/backend/api
 * services/results.ts, the SQL implementation) and is the one copy used by web
 * and mobile: when the entry has no
 * `prev` snapshot, the slot had no result before the action being undone, so
 * it's deleted; otherwise the previous result/amrapReps/setLogs/rpe are
 * written back verbatim, clearing the current slot first so nothing from the
 * undone action lingers.
 */
export function applyUndoEntry(
  results: GenericResults,
  entry: GenericUndoHistory[number]
): GenericResults {
  if (entry.prev === undefined) {
    return removeSlotResult(results, entry.i, entry.slotId);
  }
  const cleared = removeSlotResult(results, entry.i, entry.slotId);
  let restored = setSlotResult(
    cleared,
    entry.i,
    entry.slotId,
    entry.prev,
    entry.prevAmrapReps,
    entry.prevSetLogs
  );
  if (entry.prevRpe !== undefined) {
    restored = patchSlotField(restored, entry.i, entry.slotId, 'rpe', entry.prevRpe);
  }
  return restored;
}
