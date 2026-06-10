import type { GenericResults } from '@gzclp/domain/types/program';
import type { ResultValue, SetLogEntry } from '@gzclp/domain/types';

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
