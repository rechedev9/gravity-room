import { isRecord } from '@gzclp/domain/type-guards';
import type { QueuedMutation } from './mutation-queue-repository';

export class InvalidQueuedMutationError extends Error {}

export interface MutationRequest {
  readonly path: string;
  readonly method: 'POST' | 'PATCH' | 'DELETE';
  readonly body?: string;
  /** Deleting an already absent result satisfies the queued intent. */
  readonly acceptsNotFound: boolean;
}

function validWorkoutIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function encodeId(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    throw new InvalidQueuedMutationError('Invalid queued mutation identifier encoding');
  }
}

/**
 * Compile a persisted intent into its wire request without I/O. Authentication,
 * cancellation, retry policy, and acknowledgement belong to the sync worker.
 * Payload fields beyond the envelope are preserved for the API/domain validator.
 */
export function buildMutationRequest(mutation: QueuedMutation): MutationRequest {
  if (
    mutation.entityType !== 'program-instance' ||
    mutation.payloadValid === false ||
    !validId(mutation.entityId)
  ) {
    throw new InvalidQueuedMutationError('Invalid queued mutation envelope');
  }
  const path = `/programs/${encodeId(mutation.entityId)}`;
  const { workoutIndex, slotId } = mutation.payload;

  switch (mutation.operation) {
    case 'record-result': {
      const { result } = mutation.payload;
      if (
        !validWorkoutIndex(workoutIndex) ||
        !validId(slotId) ||
        (result !== 'success' && result !== 'fail')
      ) {
        throw new InvalidQueuedMutationError('Invalid record-result mutation payload');
      }
      return {
        path: `${path}/results`,
        method: 'POST',
        body: JSON.stringify(mutation.payload),
        acceptsNotFound: false,
      };
    }
    case 'update-metadata':
      if (!isRecord(mutation.payload.metadata)) {
        throw new InvalidQueuedMutationError('Invalid update-metadata mutation payload');
      }
      return {
        path: `${path}/metadata`,
        method: 'PATCH',
        body: JSON.stringify(mutation.payload),
        acceptsNotFound: false,
      };
    case 'delete-result':
      if (!validWorkoutIndex(workoutIndex) || !validId(slotId)) {
        throw new InvalidQueuedMutationError('Invalid delete-result mutation payload');
      }
      return {
        path: `${path}/results/${workoutIndex}/${encodeId(slotId)}`,
        method: 'DELETE',
        acceptsNotFound: true,
      };
    default:
      throw new InvalidQueuedMutationError(
        `Unsupported queued mutation operation: ${mutation.operation}`
      );
  }
}
