import type Redis from 'ioredis';

const PRESENCE_TTL_SEC = 60;
const PRESENCE_SORTED_SET_KEY = 'users:online';
const TTL_MS = PRESENCE_TTL_SEC * 1000;

/** Fire-and-forget: mark a user as active for the next 60 seconds. */
export function trackPresence(userId: string, redis: Redis): Promise<unknown> {
  const now = Date.now();
  const cutoff = now - TTL_MS;
  return redis
    .multi()
    .zadd(PRESENCE_SORTED_SET_KEY, String(now), userId)
    .zremrangebyscore(PRESENCE_SORTED_SET_KEY, '-inf', String(cutoff))
    .exec();
}

/** Count active users in O(log N) using a heartbeat sorted set. */
export async function countOnlineUsers(redis: Redis): Promise<number> {
  const cutoff = Date.now() - TTL_MS;
  await redis.zremrangebyscore(PRESENCE_SORTED_SET_KEY, '-inf', String(cutoff));
  return redis.zcard(PRESENCE_SORTED_SET_KEY);
}
