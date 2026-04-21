import { fetchWithAccessToken } from '../auth/session';
import {
  acknowledgeQueuedMutations,
  clearQueuedMutations as clearQueuedMutationsFromRepository,
  listQueuedMutations,
  type QueuedMutation,
} from './mutation-queue-repository';

let inFlightFlush: Promise<{ readonly processedCount: number }> | null = null;
let inFlightFlushAccessToken: string | null = null;
let inFlightFlushController: AbortController | null = null;

export async function clearQueuedMutations(): Promise<void> {
  inFlightFlushController?.abort();
  inFlightFlush = null;
  inFlightFlushAccessToken = null;
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
  const requestPath = buildProgramRequestPath(mutation.entityId);
  const headers = {
    'Content-Type': 'application/json',
  };

  let authorizedResponse: { readonly accessToken: string; readonly response: Response };

  switch (mutation.operation) {
    case 'record-result': {
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
      if (typeof workoutIndex !== 'number' || typeof slotId !== 'string') {
        throw new Error('Invalid delete-result mutation payload');
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
      throw new Error(`Unsupported queued mutation operation: ${mutation.operation}`);
  }

  const response = authorizedResponse.response;

  if (mutation.operation === 'delete-result' && response.status === 404) {
    return authorizedResponse.accessToken;
  }

  if (!response.ok) {
    throw new Error(`Queued mutation sync failed with status ${response.status}`);
  }

  return authorizedResponse.accessToken;
}

export async function flushQueuedMutations(
  accessToken: string
): Promise<{ readonly processedCount: number }> {
  if (inFlightFlush) {
    if (inFlightFlushAccessToken === accessToken) {
      return inFlightFlush;
    }

    inFlightFlushController?.abort();
    inFlightFlush = null;
    inFlightFlushAccessToken = null;
    inFlightFlushController = null;
  }

  const abortController = new AbortController();

  const flushPromise = (async (): Promise<{ readonly processedCount: number }> => {
    const queuedMutations = await listQueuedMutations();
    if (queuedMutations.length === 0) {
      return { processedCount: 0 };
    }

    let nextAccessToken = accessToken;
    const acknowledgedIds: number[] = [];

    for (const mutation of queuedMutations) {
      try {
        nextAccessToken = await replayQueuedMutation(
          mutation,
          nextAccessToken,
          abortController.signal
        );
        acknowledgedIds.push(mutation.id);
      } catch (error) {
        if (acknowledgedIds.length > 0) {
          await acknowledgeQueuedMutations(acknowledgedIds);
        }

        throw error;
      }
    }

    await acknowledgeQueuedMutations(acknowledgedIds);

    return {
      processedCount: acknowledgedIds.length,
    };
  })();

  inFlightFlush = flushPromise;
  inFlightFlushAccessToken = accessToken;
  inFlightFlushController = abortController;

  try {
    return await flushPromise;
  } finally {
    if (inFlightFlush === flushPromise) {
      inFlightFlush = null;
      inFlightFlushAccessToken = null;
      inFlightFlushController = null;
    }
  }
}
