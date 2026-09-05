import { parseRetryAfter } from '../network/retry-after';
import { publishSyncAttempt } from './sync-events';
import { readSyncBackoff, recordSyncBackoff, clearSyncBackoff } from './sync-backoff-repository';
import { RequestTimeoutError } from '../network/api-fetch';
import { isRecord } from '@gzclp/domain/type-guards';

import { fetchWithAccessToken } from '../auth/session';
import { requireActiveLocalDataOwner } from '../db/client';
import {
  acknowledgeQueuedMutations,
  clearQueuedMutations as clearQueuedMutationsFromRepository,
  listQueuedMutations,
  markQueuedMutationFailure,
  MUTATION_BATCH_SIZE,
  type QueuedMutation,
} from './mutation-queue-repository';

let inFlightFlush: Promise<{ readonly processedCount: number }> | null = null;
let inFlightFlushAccessToken: string | null = null;
let inFlightFlushOwnerId: string | null = null;
let inFlightFlushRequest: { requested: boolean; accepting: boolean } | null = null;
let inFlightFlushController: AbortController | null = null;
let volatileRetryPause: { ownerId: string; retryAt: number; recordedAt: number } | null = null;

class InvalidQueuedMutationError extends Error {}

class QueuedMutationHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAt = 0
  ) {
    super(`Queued mutation sync failed with status ${status}`);
  }
}

function isPermanentFailure(error: unknown): boolean {
  return (
    error instanceof InvalidQueuedMutationError ||
    (error instanceof QueuedMutationHttpError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![401, 408, 425, 429].includes(error.status))
  );
}

export function cancelQueuedMutationFlush(ownerId: string): void {
  if (inFlightFlushOwnerId === ownerId) inFlightFlushController?.abort();
}

export async function clearQueuedMutations(): Promise<void> {
  volatileRetryPause = null;
  inFlightFlushController?.abort();
  inFlightFlush = null;
  inFlightFlushAccessToken = null;
  inFlightFlushOwnerId = null;
  inFlightFlushController = null;

  await clearQueuedMutationsFromRepository();
}

function buildProgramRequestPath(entityId: string): string {
  return `/programs/${encodeURIComponent(entityId)}`;
}

async function replayQueuedMutation(
  mutation: QueuedMutation,
  accessToken: string,
  signal: AbortSignal
): Promise<string> {
  if (mutation.entityType !== 'program-instance' || mutation.payloadValid === false) {
    throw new InvalidQueuedMutationError('Invalid queued mutation envelope');
  }

  const requestPath = buildProgramRequestPath(mutation.entityId);
  const headers = {
    'Content-Type': 'application/json',
  };

  let authorizedResponse: { readonly accessToken: string; readonly response: Response };

  switch (mutation.operation) {
    case 'record-result': {
      const workoutIndex = mutation.payload.workoutIndex;
      const slotId = mutation.payload.slotId;
      const result = mutation.payload.result;
      if (
        !Number.isInteger(workoutIndex) ||
        typeof workoutIndex !== 'number' ||
        workoutIndex < 0 ||
        typeof slotId !== 'string' ||
        slotId.length === 0 ||
        (result !== 'success' && result !== 'fail')
      ) {
        throw new InvalidQueuedMutationError('Invalid record-result mutation payload');
      }

      authorizedResponse = await fetchWithAccessToken(
        `${requestPath}/results`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(mutation.payload),
          signal,
        },
        { initialAccessToken: accessToken }
      );
      break;
    }
    case 'update-metadata': {
      if (!isRecord(mutation.payload.metadata)) {
        throw new InvalidQueuedMutationError('Invalid update-metadata mutation payload');
      }

      authorizedResponse = await fetchWithAccessToken(
        `${requestPath}/metadata`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(mutation.payload),
          signal,
        },
        { initialAccessToken: accessToken }
      );
      break;
    }
    case 'delete-result': {
      const workoutIndex = mutation.payload.workoutIndex;
      const slotId = mutation.payload.slotId;
      if (
        !Number.isInteger(workoutIndex) ||
        typeof workoutIndex !== 'number' ||
        workoutIndex < 0 ||
        typeof slotId !== 'string' ||
        slotId.length === 0
      ) {
        throw new InvalidQueuedMutationError('Invalid delete-result mutation payload');
      }

      authorizedResponse = await fetchWithAccessToken(
        `${requestPath}/results/${workoutIndex}/${encodeURIComponent(slotId)}`,
        {
          method: 'DELETE',
          headers,
          signal,
        },
        { initialAccessToken: accessToken }
      );
      break;
    }
    default:
      throw new InvalidQueuedMutationError(
        `Unsupported queued mutation operation: ${mutation.operation}`
      );
  }

  const response = authorizedResponse.response;

  if (mutation.operation === 'delete-result' && response.status === 404) {
    return authorizedResponse.accessToken;
  }

  if (!response.ok) {
    throw new QueuedMutationHttpError(
      response.status,
      parseRetryAfter(response.headers.get('Retry-After'))
    );
  }

  return authorizedResponse.accessToken;
}

export async function flushQueuedMutations(
  accessToken: string
): Promise<{ readonly processedCount: number }> {
  // Capture the validated owner once. A concurrent account transition can
  // deactivate/change the global owner, but this flush remains bound to the
  // original partition and token until it is aborted.
  const ownerId = requireActiveLocalDataOwner();

  if (inFlightFlush) {
    if (
      inFlightFlushAccessToken === accessToken &&
      inFlightFlushOwnerId === ownerId &&
      inFlightFlushRequest?.accepting &&
      !inFlightFlushController?.signal.aborted
    ) {
      if (inFlightFlushRequest) inFlightFlushRequest.requested = true;
      return inFlightFlush;
    }

    inFlightFlushController?.abort();
    inFlightFlush = null;
    inFlightFlushAccessToken = null;
    inFlightFlushOwnerId = null;
    inFlightFlushController = null;
  }

  let failed = false;
  let retryable = true;
  let retryAt: number | undefined;
  const abortController = new AbortController();
  const request = { requested: false, accepting: true };

  const flushPromise = (async (): Promise<{ readonly processedCount: number }> => {
    const now = Date.now();
    let memoryDeadline = 0;
    if (volatileRetryPause?.ownerId === ownerId) {
      if (now < volatileRetryPause.recordedAt) {
        volatileRetryPause.retryAt =
          now + Math.max(0, volatileRetryPause.retryAt - volatileRetryPause.recordedAt);
        volatileRetryPause.recordedAt = now;
      }
      memoryDeadline = volatileRetryPause.retryAt;
    }
    // Read durable state even while memory is paused: both clocks must rebase
    // in the same attempt. Memory still preserves server guidance if SQLite fails.
    let persistedDeadline: number;
    try {
      persistedDeadline = await readSyncBackoff(ownerId);
    } catch (error) {
      if (memoryDeadline <= Date.now()) throw error;
      persistedDeadline = memoryDeadline;
    }
    const pausedUntil = Math.max(memoryDeadline, persistedDeadline);
    if (pausedUntil > Date.now()) {
      retryAt = pausedUntil;
      throw new Error('Queued mutation sync is waiting to retry');
    }
    let processedCount = 0;
    let nextAccessToken = accessToken;
    let afterId = 0;
    let retainedFailure: unknown;
    const failedPlans = new Set<string>();
    do {
      request.requested = false;
      const queuedMutations = await listQueuedMutations(ownerId, afterId);
      if (queuedMutations.length === MUTATION_BATCH_SIZE) request.requested = true;
      const acknowledgedIds: number[] = [];
      for (const mutation of queuedMutations) {
        afterId = mutation.id;
        // Later edits for a rejected plan must not overtake its retained intent.
        // Keyset paging still permits unrelated plans beyond this page to drain.
        if (failedPlans.has(mutation.entityId)) continue;
        try {
          nextAccessToken = await replayQueuedMutation(
            mutation,
            nextAccessToken,
            abortController.signal
          );
          acknowledgedIds.push(mutation.id);
        } catch (error) {
          // Keep server guidance even if SQLite is temporarily unable to save
          // the diagnostic/backoff. Other callers must honor it in this process.
          if (
            !abortController.signal.aborted &&
            error instanceof QueuedMutationHttpError &&
            error.retryAt > Date.now()
          ) {
            retryAt = error.retryAt;
            volatileRetryPause = { ownerId, retryAt, recordedAt: Date.now() };
          }
          if (
            !abortController.signal.aborted &&
            !(error instanceof Error && error.name === 'AbortError')
          ) {
            await markQueuedMutationFailure(
              mutation.id,
              error instanceof InvalidQueuedMutationError
                ? 'INVALID_OUTBOX'
                : error instanceof QueuedMutationHttpError
                  ? `HTTP_${error.status}`
                  : error instanceof RequestTimeoutError
                    ? 'REQUEST_TIMEOUT'
                    : 'NETWORK_ERROR',
              ownerId
            );
          }
          if (isPermanentFailure(error)) {
            retainedFailure ??= error;
            failedPlans.add(mutation.entityId);
            continue;
          }
          if (acknowledgedIds.length > 0)
            await acknowledgeQueuedMutations(acknowledgedIds, ownerId);
          if (
            abortController.signal.aborted ||
            (error instanceof Error && error.name === 'AbortError')
          ) {
            retryable = false;
          } else if (error instanceof QueuedMutationHttpError && error.status === 401) {
            retryable = false;
          } else {
            retryAt = await recordSyncBackoff(
              ownerId,
              error instanceof QueuedMutationHttpError ? error.retryAt : 0,
              abortController.signal
            );
            volatileRetryPause = { ownerId, retryAt, recordedAt: Date.now() };
          }
          throw error;
        }
      }
      if (acknowledgedIds.length > 0) await acknowledgeQueuedMutations(acknowledgedIds, ownerId);
      processedCount += acknowledgedIds.length;
      // A caller may have durably enqueued another edit while this batch was
      // uploading. All joiners await the additional batch before refreshing.
    } while (request.requested);
    request.accepting = false;
    // Callers must not hydrate a server snapshot over unsent local edits.
    // Malformed rows remain available for repair rather than being discarded.
    await clearSyncBackoff(ownerId, abortController.signal);
    if (volatileRetryPause?.ownerId === ownerId) volatileRetryPause = null;
    if (retainedFailure !== undefined) {
      retryable = false;
      throw retainedFailure;
    }
    return { processedCount };
  })();

  inFlightFlush = flushPromise;
  inFlightFlushRequest = request;
  inFlightFlushAccessToken = accessToken;
  inFlightFlushOwnerId = ownerId;
  inFlightFlushController = abortController;

  try {
    return await flushPromise;
  } catch (error) {
    failed = true;
    if (error instanceof Error && error.name === 'AbortError') retryable = false;
    throw error;
  } finally {
    const ownsFlush = inFlightFlush === flushPromise;
    if (ownsFlush) {
      inFlightFlush = null;
      inFlightFlushRequest = null;
      inFlightFlushAccessToken = null;
      inFlightFlushOwnerId = null;
      inFlightFlushController = null;
    }
    if (ownsFlush)
      publishSyncAttempt({
        ownerId,
        failed,
        retryable,
        ...(retryAt === undefined ? {} : { retryAt }),
      });
  }
}
