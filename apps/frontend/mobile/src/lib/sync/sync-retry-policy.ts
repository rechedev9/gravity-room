/** Shared timing policy; callers own clocks, randomness, persistence and timers. */
const MAX_ATTEMPT = 7;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 300_000;

export function nextSyncAttempt(previous: number): number {
  if (!Number.isSafeInteger(previous) || previous < 0) {
    throw new Error('Invalid sync retry attempt');
  }
  return Math.min(previous + 1, MAX_ATTEMPT);
}

export function syncRetryDelay(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error('Invalid sync retry attempt');
  }
  return Math.min(BASE_DELAY_MS * 2 ** (Math.min(attempt, MAX_ATTEMPT) - 1), MAX_DELAY_MS);
}

/** Persistence adds up to 20% positive jitter; foreground fallback stays deterministic. */
export function syncRetryDeadline(
  attempt: number,
  now: number,
  random: number,
  serverRetryAt = 0
): number {
  if (!Number.isFinite(random) || random < 0 || random >= 1) {
    throw new Error('Invalid sync retry randomness');
  }
  return Math.max(now + Math.round(syncRetryDelay(attempt) * (1 + random * 0.2)), serverRetryAt);
}

/** Bound native timers even when a server asks for a pause beyond 32-bit milliseconds. */
export function syncRetryTimerDelay(retryAt: number, now: number): number {
  return Math.max(1, Math.min(retryAt - now, MAX_DELAY_MS));
}
