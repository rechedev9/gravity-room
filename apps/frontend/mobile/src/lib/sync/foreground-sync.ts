import { nextSyncAttempt, syncRetryDelay, syncRetryTimerDelay } from './sync-retry-policy';
import { AppState } from 'react-native';
import { getAccessToken, SessionUnavailableError } from '../auth/session';
import { getActiveLocalDataOwner } from '../db/client';
import { cancelQueuedMutationFlush, flushQueuedMutations } from './mutation-sync-service';
import { subscribeSyncAttempts, syncRequests } from './sync-events';

/** One authenticated owner owns one foreground subscription and retry timer. */
export function startForegroundSync(
  ownerId: string,
  recoverSession?: (isCurrent: () => boolean) => Promise<void>
): () => void {
  let active = AppState.currentState === 'active';
  let disposed = false;
  let running = false;
  let runRequested = false;
  let fallbackAttempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const current = (): boolean => !disposed && active && getActiveLocalDataOwner() === ownerId;
  const clearTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const run = (): void => {
    clearTimer();
    if (!current()) return;
    if (running) {
      runRequested = true;
      return;
    }
    runRequested = false;
    const token = getAccessToken();
    if (!token && !recoverSession) return;
    running = true;
    void (async () => {
      if (!token) await recoverSession?.(current);
      if (!current()) return;
      const authorizedToken = getAccessToken();
      if (authorizedToken) await flushQueuedMutations(authorizedToken);
    })()
      .catch((error: unknown) => {
        if (error instanceof SessionUnavailableError && current()) scheduleRetry(error.retryAt);
      })
      .finally(() => {
        running = false;
        // A resume can arrive while the cancelled worker is still refreshing.
        // Consume it after that worker retires instead of losing the wake-up.
        if (runRequested && current()) run();
      });
  };
  const scheduleRetry = (requestedRetryAt?: number): void => {
    clearTimer();
    fallbackAttempt = nextSyncAttempt(fallbackAttempt);
    const retryAt = requestedRetryAt ?? Date.now() + syncRetryDelay(fallbackAttempt);
    // Long server pauses are checked in bounded timer chunks, avoiding the
    // platform's signed-32-bit timer overflow. The repository enforces the date.
    timer = setTimeout(run, syncRetryTimerDelay(retryAt, Date.now()));
  };
  const unsubscribe = subscribeSyncAttempts((attempt) => {
    if (attempt.ownerId !== ownerId || !current()) return;
    clearTimer();
    if (!attempt.failed) {
      fallbackAttempt = 0;
      return;
    }
    if (!attempt.retryable) return;
    scheduleRetry(attempt.retryAt);
  });
  const unsubscribeRequests = syncRequests.subscribe((requestedOwner) => {
    if (requestedOwner === ownerId) run();
  });
  const subscription = AppState.addEventListener('change', (state) => {
    active = state === 'active';
    if (active) run();
    else {
      clearTimer();
      cancelQueuedMutationFlush(ownerId);
    }
  });
  run();
  return () => {
    disposed = true;
    clearTimer();
    unsubscribe();
    unsubscribeRequests();
    subscription.remove();
    cancelQueuedMutationFlush(ownerId);
  };
}
