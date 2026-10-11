import {
  applyUndoEntry as applyUndoEntryToResults,
  buildUndoEntry as buildUndoEntryFromResults,
  type GenericProgramDetail,
  type SetLogEntry,
} from '@gzclp/domain';

type SlotResult = GenericProgramDetail['results'][string][string];
type UndoEntry = GenericProgramDetail['undoHistory'][number];

function setLogsEqual(
  left: SlotResult['setLogs'] | undefined,
  right: SlotResult['setLogs'] | undefined
): boolean {
  if (left === right) {
    return true;
  }

  if (left === undefined || right === undefined || left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      entry.reps === other.reps &&
      entry.weight === other.weight &&
      entry.rpe === other.rpe
    );
  });
}

export function slotStateEqual(
  left: SlotResult | undefined,
  right: SlotResult | undefined
): boolean {
  return (
    left?.result === right?.result &&
    left?.amrapReps === right?.amrapReps &&
    left?.rpe === right?.rpe &&
    setLogsEqual(left?.setLogs, right?.setLogs)
  );
}

export function patchSlotMetrics(
  detail: GenericProgramDetail,
  workoutIndex: number,
  slotId: string,
  patch: {
    readonly result?: 'success' | 'fail';
    readonly amrapReps?: number | undefined;
    readonly rpe?: number | undefined;
    readonly setLogs?: readonly SetLogEntry[] | undefined;
  }
): GenericProgramDetail {
  const workoutKey = String(workoutIndex);
  const currentWorkout = detail.results[workoutKey] ?? {};
  const currentSlot = currentWorkout[slotId] ?? {};
  const nextSlot = { ...currentSlot };

  if ('result' in patch && patch.result !== undefined) {
    nextSlot.result = patch.result;
  }

  if ('amrapReps' in patch) {
    if (patch.amrapReps === undefined) {
      delete nextSlot.amrapReps;
    } else {
      nextSlot.amrapReps = patch.amrapReps;
    }
  }

  if ('rpe' in patch) {
    if (patch.rpe === undefined) {
      delete nextSlot.rpe;
    } else {
      nextSlot.rpe = patch.rpe;
    }
  }

  if ('setLogs' in patch) {
    if (patch.setLogs === undefined) {
      delete nextSlot.setLogs;
    } else {
      nextSlot.setLogs = [...patch.setLogs];
    }
  }

  return {
    ...detail,
    results: {
      ...detail.results,
      [workoutKey]: {
        ...currentWorkout,
        [slotId]: nextSlot,
      },
    },
  };
}

export function buildUndoEntry(
  detail: GenericProgramDetail,
  workoutIndex: number,
  slotId: string
): UndoEntry {
  return buildUndoEntryFromResults(detail.results, workoutIndex, slotId);
}

export function applyUndoEntry(
  detail: GenericProgramDetail,
  entry: UndoEntry
): GenericProgramDetail {
  return { ...detail, results: applyUndoEntryToResults(detail.results, entry) };
}
