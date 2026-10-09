import { InvalidApiPathIdentifierError } from '@gzclp/api-client/path-identifier';
import * as requests from '@gzclp/api-client/program-requests';
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

function compile(build: () => requests.ApiRequest): requests.ApiRequest {
  try {
    return build();
  } catch (error) {
    if (error instanceof InvalidApiPathIdentifierError) {
      throw new InvalidQueuedMutationError('Invalid queued mutation identifier encoding');
    }
    throw error;
  }
}

function writeMethod(request: requests.ApiRequest): MutationRequest['method'] {
  if (request.method === 'GET') throw new InvalidQueuedMutationError('Queued mutations never read');
  return request.method;
}

/**
 * Compile a persisted intent into its wire request without I/O. Authentication,
 * cancellation, retry policy, and acknowledgement belong to the sync worker.
 * Path and method come from the shared request builders. The persisted payload
 * is sent as stored, so fields beyond the envelope reach the API/domain validator.
 */
export function buildMutationRequest(mutation: QueuedMutation): MutationRequest {
  if (
    mutation.entityType !== 'program-instance' ||
    mutation.payloadValid === false ||
    !validId(mutation.entityId)
  ) {
    throw new InvalidQueuedMutationError('Invalid queued mutation envelope');
  }
  const instanceId = mutation.entityId;
  compile(() => requests.programDetail(instanceId));
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
      const request = compile(() =>
        requests.recordResult({ instanceId, workoutIndex, slotId, result })
      );
      return {
        path: request.path,
        method: writeMethod(request),
        body: JSON.stringify(mutation.payload),
        acceptsNotFound: false,
      };
    }
    case 'update-metadata': {
      const { metadata } = mutation.payload;
      if (!isRecord(metadata)) {
        throw new InvalidQueuedMutationError('Invalid update-metadata mutation payload');
      }
      const request = compile(() => requests.updateMetadata(instanceId, metadata));
      return {
        path: request.path,
        method: writeMethod(request),
        body: JSON.stringify(mutation.payload),
        acceptsNotFound: false,
      };
    }
    case 'delete-result': {
      if (!validWorkoutIndex(workoutIndex) || !validId(slotId)) {
        throw new InvalidQueuedMutationError('Invalid delete-result mutation payload');
      }
      const request = compile(() => requests.deleteResult({ instanceId, workoutIndex, slotId }));
      return { path: request.path, method: writeMethod(request), acceptsNotFound: true };
    }
    default:
      throw new InvalidQueuedMutationError(
        `Unsupported queued mutation operation: ${mutation.operation}`
      );
  }
}
