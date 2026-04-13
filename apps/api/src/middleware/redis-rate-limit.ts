/**
 * Redis-backed sliding-window rate limiter implementation.
 *
 * Uses a single Lua script to atomically:
 *   1. Remove timestamps outside the rolling window (ZREMRANGEBYSCORE)
 *   2. Check the current count (ZCARD)
 *   3. If under limit, add the new timestamp (ZADD) and set expiry (PEXPIRE)
 *
 * The Lua script runs atomically on the Redis server — no race conditions
 * between check and increment.
 */
import type { RateLimitStore } from './rate-limit';
import { getRedis } from '../lib/redis';

const LUA_SLIDING_WINDOW = `
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxReqs  = tonumber(ARGV[3])
local cutoff   = now - windowMs

redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)

if count >= maxReqs then
  return 0
end

redis.call('ZADD', key, now, now .. ':' .. math.random(1, 1000000))
redis.call('PEXPIRE', key, windowMs)
return 1
`;

export class RedisRateLimitStore implements RateLimitStore {
  async check(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return true; // fail-open: no Redis available

    const result = await redis.eval(
      LUA_SLIDING_WINDOW,
      1,
      key,
      String(Date.now()),
      String(windowMs),
      String(maxRequests)
    );

    return result === 1;
  }
}
