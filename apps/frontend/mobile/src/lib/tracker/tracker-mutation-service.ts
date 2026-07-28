import { captureAuthorizedSession } from '../auth/session';
import { enqueueMutation, type MutationPayload } from '../sync/mutation-queue-repository';
import { flushQueuedMutations } from '../sync/mutation-sync-service';

type TrackerResultValue = 'success' | 'fail';

type QueueRecordResultInput = {
  readonly ownerUserId: string;
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result: TrackerResultValue;
  readonly amrapReps?: number;
  readonly rpe?: number;
  readonly setLogs?: readonly MutationPayload[];
};

type QueueUpdateMetadataInput = {
  readonly ownerUserId: string;
  readonly instanceId: string;
  readonly metadata: MutationPayload;
};

type QueueUndoRestoreInput = {
  readonly ownerUserId: string;
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result?: TrackerResultValue;
  readonly amrapReps?: number;
  readonly rpe?: number;
  readonly setLogs?: readonly MutationPayload[];
};

type QueueDeleteResultInput = {
  readonly ownerUserId: string;
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
};

async function enqueueTrackerMutation(input: {
  readonly ownerUserId: string;
  readonly instanceId: string;
  readonly operation: string;
  readonly payload: MutationPayload;
}): Promise<void> {
  const ownerUserId = input.ownerUserId;
  await enqueueMutation({
    ownerUserId,
    entityType: 'program-instance',
    entityId: input.instanceId,
    operation: input.operation,
    payload: input.payload,
  });

  let session;
  try {
    session = captureAuthorizedSession(ownerUserId);
  } catch {
    return;
  }

  try {
    await flushQueuedMutations(session);
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
    ownerUserId: input.ownerUserId,
    instanceId: input.instanceId,
    operation: 'record-result',
    payload,
  });
}

export async function queueUpdateMetadataMutation(input: QueueUpdateMetadataInput): Promise<void> {
  await enqueueTrackerMutation({
    ownerUserId: input.ownerUserId,
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
      ownerUserId: input.ownerUserId,
      instanceId: input.instanceId,
      workoutIndex: input.workoutIndex,
      slotId: input.slotId,
    });
    return;
  }

  await queueRecordResultMutation({
    ownerUserId: input.ownerUserId,
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
    ownerUserId: input.ownerUserId,
    instanceId: input.instanceId,
    operation: 'delete-result',
    payload: {
      workoutIndex: input.workoutIndex,
      slotId: input.slotId,
    },
  });
}
