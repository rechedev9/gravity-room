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
