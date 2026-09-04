import { deriveResultFromSetLogsSimple, type SetLogEntry } from '@gzclp/domain';

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

export function slotSupportsSetFlow(slot: {
  readonly prescriptions: readonly unknown[] | undefined;
  readonly isGpp: boolean | undefined;
  readonly isTestSlot: boolean | undefined;
}): boolean {
  return slot.prescriptions === undefined && slot.isGpp !== true && slot.isTestSlot !== true;
}

export function deriveCompletedSlotResult(
  logs: readonly SetLogEntry[],
  targetReps: number
): 'success' | 'fail' {
  return deriveResultFromSetLogsSimple(logs, targetReps) ?? 'success';
}
