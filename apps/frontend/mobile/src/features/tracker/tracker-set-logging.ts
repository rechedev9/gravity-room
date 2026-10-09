import type { SetLogEntry } from '@gzclp/domain';

export function slotLogKey(workoutIndex: number, slotId: string): string {
  return `${workoutIndex}:${slotId}`;
}

export function nextSetIndex(logs: readonly SetLogEntry[] | undefined): number {
  return logs?.length ?? 0;
}

export function appendSetLog(
  logs: readonly SetLogEntry[] | undefined,
  entry: SetLogEntry
): readonly SetLogEntry[] {
  return [...(logs ?? []), entry];
}

export function popSetLog(
  logs: readonly SetLogEntry[] | undefined
): readonly SetLogEntry[] | undefined {
  if (logs === undefined || logs.length === 0) {
    return undefined;
  }

  const next = logs.slice(0, -1);
  return next.length === 0 ? undefined : next;
}

/** A manual fail after some sets keeps them and closes the slot with the set that was missed.
 * The domain reads a failure as a logged set below the target, so the miss carries 0 reps. */
export function withMissedSet(
  logs: readonly SetLogEntry[],
  fallbackWeight: number
): readonly SetLogEntry[] {
  const weight = logs.at(-1)?.weight ?? fallbackWeight;
  return [...logs, { reps: 0, weight }];
}

/** Bodyweight and general prep work carry no barbell load: the slot weight is the lifter's own
 * mass or zero, so it is never shown or logged as a lifted weight. */
export function slotIsLoadless(slot: {
  readonly isBodyweight: boolean | undefined;
  readonly isGpp: boolean | undefined;
}): boolean {
  return slot.isBodyweight === true || slot.isGpp === true;
}

export function slotSupportsSetFlow(slot: {
  readonly prescriptions: readonly unknown[] | undefined;
  readonly isGpp: boolean | undefined;
  readonly isTestSlot: boolean | undefined;
}): boolean {
  return slot.prescriptions === undefined && slot.isGpp !== true && slot.isTestSlot !== true;
}
