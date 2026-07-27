import type { Redis } from './redis';

const PRESENCE_TTL_SEC = 60;
const PRESENCE_SORTED_SET_KEY = 'users:online';
const TTL_MS = PRESENCE_TTL_SEC * 1000;

// Debounce window: a user's heartbeat is written at most once per 30s.
// Cuts Redis ZADD traffic to ~2/min/user under request bursts.
const TRACK_DEBOUNCE_MS = 30_000;
const MAX_DEBOUNCE_ENTRIES = 10_000;
const lastTrackByUser = new Map<string, number>();
let lastDebounceCleanupAt = 0;

interface PresenceWriter {
  zadd(key: string, entry: { score: number; member: string }): Promise<unknown>;
}

function prunePresenceDebounce(now: number): void {
  if (now - lastDebounceCleanupAt >= TRACK_DEBOUNCE_MS) {
    for (const [userId, lastTrackAt] of lastTrackByUser) {
      if (now - lastTrackAt >= TRACK_DEBOUNCE_MS) {
        lastTrackByUser.delete(userId);
      }
    }
    lastDebounceCleanupAt = now;
  }

  // Bound memory even during a burst of entirely new user IDs. Evicting the
  // oldest debounce entry can only cause one extra Redis heartbeat; it cannot
  // make presence inaccurate.
  if (lastTrackByUser.size >= MAX_DEBOUNCE_ENTRIES) {
    const oldest = lastTrackByUser.keys().next();
    if (!oldest.done) lastTrackByUser.delete(oldest.value);
  }
}

/** Fire-and-forget: mark a user as active for the next 60 seconds. */
export function trackPresence(userId: string, redis: PresenceWriter): Promise<unknown> {
  const now = Date.now();
  const last = lastTrackByUser.get(userId);
  if (last !== undefined && now - last < TRACK_DEBOUNCE_MS) {
    return Promise.resolve(); // recent heartbeat already on record
  }
  prunePresenceDebounce(now);
  lastTrackByUser.set(userId, now);
  return redis.zadd(PRESENCE_SORTED_SET_KEY, { score: now, member: userId });
}

/** Count active users in O(log N) using a heartbeat sorted set. */
export async function countOnlineUsers(redis: Redis): Promise<number> {
  const cutoff = Date.now() - TTL_MS;
  await redis.zremrangebyscore(PRESENCE_SORTED_SET_KEY, '-inf', cutoff);
  return redis.zcard(PRESENCE_SORTED_SET_KEY);
}

/**
 * Periodic janitor: prunes expired heartbeats. Runs on a single timer in
 * bootstrap.ts instead of inline on every `trackPresence` call.
 */
export async function runPresenceJanitor(redis: Redis): Promise<void> {
  const cutoff = Date.now() - TTL_MS;
  await redis.zremrangebyscore(PRESENCE_SORTED_SET_KEY, '-inf', cutoff);
}
