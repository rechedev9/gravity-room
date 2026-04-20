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

function getApiBaseUrl(): string {
  const processLike = Reflect.get(globalThis, 'process');
  if (typeof processLike !== 'object' || processLike === null) {
    return 'http://localhost:3001';
  }

  const envLike = Reflect.get(processLike, 'env');
  if (typeof envLike !== 'object' || envLike === null) {
    return 'http://localhost:3001';
  }

  const configuredBaseUrl = Reflect.get(envLike, 'EXPO_PUBLIC_API_URL');
  return typeof configuredBaseUrl === 'string' ? configuredBaseUrl : 'http://localhost:3001';
}

function buildProgramRequestUrl(entityId: string): URL {
  const requestUrl = new URL(getApiBaseUrl());
  const basePath = requestUrl.pathname.replace(/\/$/, '');
  requestUrl.pathname = `${basePath}/programs/${encodeURIComponent(entityId)}`;
  return requestUrl;
}

async function replayQueuedMutation(
  mutation: QueuedMutation,
  accessToken: string,
  signal: AbortSignal
): Promise<void> {
  const requestUrl = buildProgramRequestUrl(mutation.entityId);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  let response: Response;

  switch (mutation.operation) {
    case 'record-result': {
      response = await fetch(`${requestUrl.toString()}/results`, {
        method: 'POST',
        headers,
        body: JSON.stringify(mutation.payload),
        signal,
      });
      break;
    }
    case 'update-metadata': {
      response = await fetch(`${requestUrl.toString()}/metadata`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(mutation.payload),
        signal,
      });
      break;
    }
    case 'delete-result': {
      const workoutIndex = mutation.payload.workoutIndex;
      const slotId = mutation.payload.slotId;
      if (typeof workoutIndex !== 'number' || typeof slotId !== 'string') {
        throw new Error('Invalid delete-result mutation payload');
      }

      response = await fetch(
        `${requestUrl.toString()}/results/${workoutIndex}/${encodeURIComponent(slotId)}`,
        {
          method: 'DELETE',
          headers,
          signal,
        }
      );
      break;
    }
    default:
      throw new Error(`Unsupported queued mutation operation: ${mutation.operation}`);
  }

  if (mutation.operation === 'delete-result' && response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new Error(`Queued mutation sync failed with status ${response.status}`);
  }
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

    const acknowledgedIds: number[] = [];

    for (const mutation of queuedMutations) {
      try {
        await replayQueuedMutation(mutation, accessToken, abortController.signal);
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
