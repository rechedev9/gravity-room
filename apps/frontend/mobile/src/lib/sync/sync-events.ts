import { createObserverSignal } from './observer-signal';

export interface SyncAttempt {
  readonly ownerId: string;
  readonly failed: boolean;
  readonly retryable: boolean;
  readonly retryAt?: number;
}

const attempts = createObserverSignal<SyncAttempt>();
export const subscribeSyncAttempts = attempts.subscribe;
export const publishSyncAttempt = attempts.publish;

/** Owner-scoped notifications never change the result of a durable operation. */
export const queueChanges = createObserverSignal<string>();
export const syncRequests = createObserverSignal<string>();
