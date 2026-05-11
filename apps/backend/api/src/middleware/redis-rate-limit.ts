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
import { createHash } from 'node:crypto';
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

// Pre-compute SHA1 once at module load. EVALSHA sends only this digest on the
// hot path; Redis caches the script body after the first EVAL, so subsequent
// calls avoid re-shipping the full Lua source on every request.
const LUA_SHA = createHash('sha1').update(LUA_SLIDING_WINDOW).digest('hex');

function isNoScriptError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes('NOSCRIPT');
}

export class RedisRateLimitStore implements RateLimitStore {
  async check(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return true; // fail-open: no Redis available

    const args: [number, string, string, string, string] = [
      1,
      key,
      String(Date.now()),
      String(windowMs),
      String(maxRequests),
    ];

    // Try EVALSHA first; on cache miss (NOSCRIPT) Redis tells us to fall back
    // to EVAL, which repopulates the script cache for future EVALSHA calls.
    let result: unknown;
    try {
      result = await redis.evalsha(LUA_SHA, ...args);
    } catch (err: unknown) {
      if (!isNoScriptError(err)) throw err;
      result = await redis.eval(LUA_SLIDING_WINDOW, ...args);
    }

    return result === 1;
  }
}
