import { computeGenericProgram } from './generic-engine';
import type { GenericResults, ProgramDefinition } from './types/program';
import type { ResultValue } from './types';

/**
 * What a slot looks like the next time it comes up, given a hypothetical result
 * for the current session.  This is the single source of truth for every "what
 * happens if I fail this set" / "next session you lift X" affordance in the UI:
 * the answer is always produced by replaying the real engine, never by
 * re-deriving progression rules in app code.
 */
export interface SlotOutcomePreview {
  /** Index of the workout where this slot appears next. */
  readonly workoutIndex: number;
  readonly weight: number;
  /** 0-based stage index within the slot's stage ladder. */
  readonly stage: number;
  readonly stagesCount: number;
  readonly sets: number;
  readonly reps: number;
  readonly isAmrap: boolean;
}

/** Reference values for the same slot in the current workout. */
export interface SlotOutcomeComparison {
  readonly current: SlotOutcomePreview;
  readonly next: SlotOutcomePreview;
  /** Next weight minus current weight (negative on a deload). */
  readonly weightDelta: number;
  readonly stageChanged: boolean;
}

function readSlot(
  rows: ReturnType<typeof computeGenericProgram>,
  workoutIndex: number,
  slotId: string
): SlotOutcomePreview | null {
  const row = rows[workoutIndex];
  const slot = row?.slots.find((s) => s.slotId === slotId);
  if (slot === undefined) return null;
  return {
    workoutIndex,
    weight: slot.weight,
    stage: slot.stage,
    stagesCount: slot.stagesCount,
    sets: slot.sets,
    reps: slot.reps,
    isAmrap: slot.isAmrap,
  };
}

function findNextOccurrence(
  rows: ReturnType<typeof computeGenericProgram>,
  afterIndex: number,
  slotId: string
): SlotOutcomePreview | null {
  for (let i = afterIndex + 1; i < rows.length; i++) {
    const found = readSlot(rows, i, slotId);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Replay the program with `value` injected for one slot and report how that
 * slot looks the next time it is scheduled.
 *
 * Returns `null` when the slot never comes up again (last cycle) or the ids do
 * not resolve.  Only the rows up to the next full cycle are materialised, so
 * this stays cheap enough to run on every render of a session screen.
 */
export function previewSlotOutcome(
  definition: ProgramDefinition,
  config: Record<string, number | string>,
  results: GenericResults,
  workoutIndex: number,
  slotId: string,
  value: ResultValue
): SlotOutcomeComparison | null {
  if (workoutIndex < 0) return null;

  // One full cycle past the current workout is enough to reach the next
  // occurrence of any slot, whichever day it lives on.
  const maxRows = Math.min(definition.totalWorkouts, workoutIndex + definition.days.length + 1);

  const currentRows = computeGenericProgram(definition, config, results, { maxRows });
  const current = readSlot(currentRows, workoutIndex, slotId);
  if (current === null) return null;

  const hypothetical: GenericResults = {
    ...results,
    [String(workoutIndex)]: {
      ...results[String(workoutIndex)],
      [slotId]: { ...results[String(workoutIndex)]?.[slotId], result: value, setLogs: undefined },
    },
  };

  const nextRows = computeGenericProgram(definition, config, hypothetical, { maxRows });
  const next = findNextOccurrence(nextRows, workoutIndex, slotId);
  if (next === null) return null;

  return {
    current,
    next,
    weightDelta: Math.round((next.weight - current.weight) * 1000) / 1000,
    stageChanged: next.stage !== current.stage,
  };
}
