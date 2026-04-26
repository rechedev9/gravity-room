import type { GenericProgramDetail } from '@gzclp/domain';

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
    readonly setLogs?: SlotResult['setLogs'];
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
      nextSlot.setLogs = patch.setLogs;
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
  const currentSlot = detail.results[String(workoutIndex)]?.[slotId];

  return {
    i: workoutIndex,
    slotId,
    ...(currentSlot?.result !== undefined ? { prev: currentSlot.result } : {}),
    ...(currentSlot?.rpe !== undefined ? { prevRpe: currentSlot.rpe } : {}),
    ...(currentSlot?.amrapReps !== undefined ? { prevAmrapReps: currentSlot.amrapReps } : {}),
    ...(currentSlot?.setLogs !== undefined ? { prevSetLogs: currentSlot.setLogs } : {}),
  };
}

export function applyUndoEntry(
  detail: GenericProgramDetail,
  entry: UndoEntry
): GenericProgramDetail {
  if (entry.prev === undefined) {
    return removeSlotResult(detail, entry.i, entry.slotId);
  }

  return patchSlotMetrics(detail, entry.i, entry.slotId, {
    result: entry.prev,
    amrapReps: entry.prevAmrapReps,
    rpe: entry.prevRpe,
    setLogs: entry.prevSetLogs,
  });
}

function removeSlotResult(
  detail: GenericProgramDetail,
  workoutIndex: number,
  slotId: string
): GenericProgramDetail {
  const workoutKey = String(workoutIndex);
  const currentWorkout = detail.results[workoutKey] ?? {};
  const nextWorkout = { ...currentWorkout };
  delete nextWorkout[slotId];

  if (Object.keys(nextWorkout).length === 0) {
    const nextResults = { ...detail.results };
    delete nextResults[workoutKey];
    return {
      ...detail,
      results: nextResults,
    };
  }

  return {
    ...detail,
    results: {
      ...detail.results,
      [workoutKey]: nextWorkout,
    },
  };
}
