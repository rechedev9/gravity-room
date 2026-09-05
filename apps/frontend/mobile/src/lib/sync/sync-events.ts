export interface SyncAttempt {
  readonly ownerId: string;
  readonly failed: boolean;
  readonly retryable: boolean;
  readonly retryAt?: number;
}

const listeners = new Set<(attempt: SyncAttempt) => void>();

export function subscribeSyncAttempts(listener: (attempt: SyncAttempt) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishSyncAttempt(attempt: SyncAttempt): void {
  for (const listener of listeners) {
    try {
      listener(attempt);
    } catch {
      // Observers cannot turn an already committed edit/acknowledgement into failure.
    }
  }
}

/** Owner-scoped notifications never change the result of a durable operation. */
function ownerSignal() {
  const subscribers = new Set<(ownerId: string) => void>();
  return {
    subscribe(listener: (ownerId: string) => void): () => void {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    publish(ownerId: string): void {
      for (const listener of subscribers) {
        try {
          listener(ownerId);
        } catch {
          /* An observer does not own the edit. */
        }
      }
    },
  };
}

export const queueChanges = ownerSignal();
export const syncRequests = ownerSignal();
