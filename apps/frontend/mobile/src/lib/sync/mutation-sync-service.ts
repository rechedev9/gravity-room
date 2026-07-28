import { fetchWithAuthorizedSession, type AuthorizedSession } from '../auth/session';
import {
  acknowledgeQueuedMutations,
  clearQueuedMutations as clearQueuedMutationsFromRepository,
  listQueuedMutations,
  type QueuedMutation,
} from './mutation-queue-repository';

let inFlightFlush: Promise<{ readonly processedCount: number }> | null = null;
let inFlightFlushSession: AuthorizedSession | null = null;
let inFlightFlushController: AbortController | null = null;

export async function clearQueuedMutations(ownerUserId: string): Promise<void> {
  inFlightFlushController?.abort();
  inFlightFlush = null;
  inFlightFlushSession = null;
  inFlightFlushController = null;

  await clearQueuedMutationsFromRepository(ownerUserId);
}

function buildProgramRequestPath(entityId: string): string {
  return `/programs/${encodeURIComponent(entityId)}`;
}

async function replayQueuedMutation(
  mutation: QueuedMutation,
  session: AuthorizedSession,
  signal: AbortSignal
): Promise<void> {
  const requestPath = buildProgramRequestPath(mutation.entityId);
  const headers = {
    'Content-Type': 'application/json',
  };

  let response: Response;

  switch (mutation.operation) {
    case 'record-result': {
      response = await fetchWithAuthorizedSession(session, `${requestPath}/results`, {
        method: 'POST',
        headers,
        body: JSON.stringify(mutation.payload),
        signal,
      });
      break;
    }
    case 'update-metadata': {
      response = await fetchWithAuthorizedSession(session, `${requestPath}/metadata`, {
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

      response = await fetchWithAuthorizedSession(
        session,
        `${requestPath}/results/${workoutIndex}/${encodeURIComponent(slotId)}`,
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
  session: AuthorizedSession
): Promise<{ readonly processedCount: number }> {
  const ownerUserId = session.ownerUserId;
  if (inFlightFlush) {
    if (
      inFlightFlushSession?.ownerUserId === session.ownerUserId &&
      inFlightFlushSession.generation === session.generation
    ) {
      return inFlightFlush;
    }

    inFlightFlushController?.abort();
    inFlightFlush = null;
    inFlightFlushSession = null;
    inFlightFlushController = null;
  }

  const abortController = new AbortController();

  const flushPromise = (async (): Promise<{ readonly processedCount: number }> => {
    const queuedMutations = await listQueuedMutations(ownerUserId);
    if (queuedMutations.length === 0) {
      return { processedCount: 0 };
    }

    const acknowledgedIds: number[] = [];

    for (const mutation of queuedMutations) {
      try {
        await replayQueuedMutation(mutation, session, abortController.signal);
        acknowledgedIds.push(mutation.id);
      } catch (error) {
        if (acknowledgedIds.length > 0) {
          await acknowledgeQueuedMutations(ownerUserId, acknowledgedIds);
        }

        throw error;
      }
    }

    await acknowledgeQueuedMutations(ownerUserId, acknowledgedIds);

    return {
      processedCount: acknowledgedIds.length,
    };
  })();

  inFlightFlush = flushPromise;
  inFlightFlushSession = session;
  inFlightFlushController = abortController;

  try {
    return await flushPromise;
  } finally {
    if (inFlightFlush === flushPromise) {
      inFlightFlush = null;
      inFlightFlushSession = null;
      inFlightFlushController = null;
    }
  }
}
