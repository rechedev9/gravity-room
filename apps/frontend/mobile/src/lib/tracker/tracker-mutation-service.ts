import { getAccessToken } from '../auth/session';
import { enqueueMutation, type MutationPayload } from '../sync/mutation-queue-repository';
import { flushQueuedMutations } from '../sync/mutation-sync-service';

type TrackerResultValue = 'success' | 'fail';

type QueueRecordResultInput = {
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result: TrackerResultValue;
  readonly amrapReps?: number;
  readonly rpe?: number;
  readonly setLogs?: readonly MutationPayload[];
};

type QueueUpdateMetadataInput = {
  readonly instanceId: string;
  readonly metadata: MutationPayload;
};

type QueueUndoRestoreInput = {
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result?: TrackerResultValue;
  readonly amrapReps?: number;
  readonly rpe?: number;
  readonly setLogs?: readonly MutationPayload[];
};

type QueueDeleteResultInput = {
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
};

async function enqueueTrackerMutation(input: {
  readonly instanceId: string;
  readonly operation: string;
  readonly payload: MutationPayload;
}): Promise<void> {
  await enqueueMutation({
    entityType: 'program-instance',
    entityId: input.instanceId,
    operation: input.operation,
    payload: input.payload,
  });

  const accessToken = getAccessToken();
  if (!accessToken) {
    return;
  }

  try {
    await flushQueuedMutations(accessToken);
  } catch {
    // Leave the queued mutation in place for a later retry.
  }
}

export async function queueRecordResultMutation(input: QueueRecordResultInput): Promise<void> {
  const payload: MutationPayload = {
    workoutIndex: input.workoutIndex,
    slotId: input.slotId,
    result: input.result,
  };

  if (input.result === 'success' && input.amrapReps !== undefined) {
    payload.amrapReps = input.amrapReps;
  }

  if (input.result === 'success' && input.rpe !== undefined) {
    payload.rpe = input.rpe;
  }

  if (input.setLogs !== undefined) {
    payload.setLogs = [...input.setLogs];
  }

  await enqueueTrackerMutation({
    instanceId: input.instanceId,
    operation: 'record-result',
    payload,
  });
}

export async function queueUpdateMetadataMutation(input: QueueUpdateMetadataInput): Promise<void> {
  await enqueueTrackerMutation({
    instanceId: input.instanceId,
    operation: 'update-metadata',
    payload: {
      metadata: input.metadata,
    },
  });
}

export async function queueUndoRestoreMutation(input: QueueUndoRestoreInput): Promise<void> {
  if (input.result === undefined) {
    await queueDeleteResultMutation({
      instanceId: input.instanceId,
      workoutIndex: input.workoutIndex,
      slotId: input.slotId,
    });
    return;
  }

  await queueRecordResultMutation({
    instanceId: input.instanceId,
    workoutIndex: input.workoutIndex,
    slotId: input.slotId,
    result: input.result,
    ...(input.amrapReps !== undefined ? { amrapReps: input.amrapReps } : {}),
    ...(input.rpe !== undefined ? { rpe: input.rpe } : {}),
    ...(input.setLogs !== undefined ? { setLogs: input.setLogs } : {}),
  });
}

export async function queueDeleteResultMutation(input: QueueDeleteResultInput): Promise<void> {
  await enqueueTrackerMutation({
    instanceId: input.instanceId,
    operation: 'delete-result',
    payload: {
      workoutIndex: input.workoutIndex,
      slotId: input.slotId,
    },
  });
}
