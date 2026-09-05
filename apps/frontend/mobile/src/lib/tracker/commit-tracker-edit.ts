import { GenericProgramDetailSchema, type GenericProgramDetail } from '@gzclp/domain';

import { getAccessToken } from '../auth/session';
import {
  bootstrapDatabase,
  getDatabase,
  getActiveLocalDataOwner,
  requireActiveLocalDataOwner,
} from '../db/client';
import { prepareQueuedMutation, writeQueuedMutation } from '../sync/mutation-queue-repository';
import { flushQueuedMutations } from '../sync/mutation-sync-service';
import { prepareProgramDetail, writeProgramDetail } from './program-detail-repository';

/**
 * A local edit is durable only when its snapshot and delivery intent commit
 * together. No network or nested transaction belongs inside this boundary.
 */
export async function commitTrackerEdit(
  detail: GenericProgramDetail,
  target: { readonly workoutIndex: number; readonly slotId: string }
): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  const snapshot = GenericProgramDetailSchema.parse(detail);
  if (!Number.isInteger(target.workoutIndex) || target.workoutIndex < 0 || !target.slotId) {
    throw new Error('Invalid workout edit target');
  }
  const slot = snapshot.results[String(target.workoutIndex)]?.[target.slotId];
  const preparedDetail = prepareProgramDetail(snapshot);
  const mutation = prepareQueuedMutation({
    entityType: 'program-instance',
    entityId: snapshot.id,
    operation: slot?.result === undefined ? 'delete-result' : 'record-result',
    dedupeKey: `program-instance:${snapshot.id}:result:${target.workoutIndex}:${target.slotId}`,
    payload: {
      workoutIndex: target.workoutIndex,
      slotId: target.slotId,
      ...(slot?.result !== undefined ? { result: slot.result } : {}),
      ...(slot?.result === 'success' && slot.amrapReps !== undefined
        ? { amrapReps: slot.amrapReps }
        : {}),
      ...(slot?.result === 'success' && slot.rpe !== undefined ? { rpe: slot.rpe } : {}),
      ...(slot?.setLogs !== undefined ? { setLogs: slot.setLogs } : {}),
    },
  });
  const database = getDatabase();
  await bootstrapDatabase(database);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Edit owner changed before commit');
    await writeProgramDetail(transaction, ownerId, preparedDetail);
    await writeQueuedMutation(transaction, ownerId, mutation);
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Edit owner changed during commit');
  });

  // Delivery failure must never turn an already committed local edit into a
  // failed UI operation. The durable outbox owns retry after process restart.
  const accessToken = getAccessToken();
  if (accessToken && getActiveLocalDataOwner() === ownerId) {
    void flushQueuedMutations(accessToken).catch(() => undefined);
  }
}
