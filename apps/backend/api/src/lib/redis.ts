import { Redis as IORedis } from 'ioredis';
import { logger } from './logger';

// Mandatory in production (module init throws). Without REDIS_URL in development
// getRedis() returns undefined and callers degrade: presence null, cache miss, no limiting.
if (process.env['NODE_ENV'] === 'production' && !process.env['REDIS_URL']) {
  throw new Error('REDIS_URL is required in production');
}

// The previous fixed window counts in proportion to how much of it the sliding window
// still covers. Returns the remaining budget, -1 on deny; a denied request is not charged.
const SLIDING_WINDOW_SCRIPT = `
local limit = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local window = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local previous = tonumber(redis.call('GET', KEYS[2]) or '0')
previous = math.floor((1 - (now % window) / window) * previous)
if previous + current + cost > limit then
  return -1
end
local updated = redis.call('INCRBY', KEYS[1], cost)
if updated == cost then
  redis.call('PEXPIRE', KEYS[1], window * 2 + 1000)
end
return limit - (updated + previous)
`;

export interface SlidingWindowOptions {
  readonly key: string;
  readonly limit: number;
  readonly windowMs: number;
  readonly cost: number;
}

export interface SlidingWindowResult {
  readonly success: boolean;
  /** Epoch ms at which the current fixed window ends. */
  readonly reset: number;
}

/** Values are JSON-encoded on write and decoded on read. */
export interface Redis {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts: { readonly ex: number }): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  scan(
    cursor: string,
    opts: { readonly match: string; readonly count: number }
  ): Promise<[string, string[]]>;
  incr(key: string): Promise<number>;
  zadd(key: string, entry: { readonly score: number; readonly member: string }): Promise<unknown>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number>;
  zcard(key: string): Promise<number>;
  ping(): Promise<unknown>;
  slidingWindow(opts: SlidingWindowOptions): Promise<SlidingWindowResult>;
}

class JsonRedis implements Redis {
  constructor(readonly client: IORedis) {}

  async get(key: string): Promise<unknown> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    // A non-JSON value comes back raw so the caller's shape guard evicts it.
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  set(key: string, value: unknown, opts: { readonly ex: number }): Promise<unknown> {
    return this.client.set(key, JSON.stringify(value), 'EX', opts.ex);
  }

  del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  scan(
    cursor: string,
    opts: { readonly match: string; readonly count: number }
  ): Promise<[string, string[]]> {
    return this.client.scan(cursor, 'MATCH', opts.match, 'COUNT', opts.count);
  }

  incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  zadd(key: string, entry: { readonly score: number; readonly member: string }): Promise<unknown> {
    return this.client.zadd(key, entry.score, entry.member);
  }

  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    return this.client.zremrangebyscore(key, min, max);
  }

  zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  ping(): Promise<unknown> {
    return this.client.ping();
  }

  async slidingWindow(opts: SlidingWindowOptions): Promise<SlidingWindowResult> {
    const now = Date.now();
    const window = Math.floor(now / opts.windowMs);
    const remaining = await this.client.eval(
      SLIDING_WINDOW_SCRIPT,
      2,
      `${opts.key}:${window}`,
      `${opts.key}:${window - 1}`,
      opts.limit,
      now,
      opts.windowMs,
      opts.cost
    );
    if (typeof remaining !== 'number') {
      throw new Error('Sliding-window script returned a non-integer reply');
    }
    return { success: remaining >= 0, reset: (window + 1) * opts.windowMs };
  }
}

let _redis: JsonRedis | undefined;
let _warnedMissing = false;

/**
 * Returns the singleton client, or undefined without REDIS_URL (development only).
 * The env is read on first call so a late-populated env is still seen.
 */
export function getRedis(): Redis | undefined {
  if (_redis) return _redis;

  const url = process.env['REDIS_URL'];
  if (!url) {
    if (!_warnedMissing) {
      _warnedMissing = true;
      logger.warn('REDIS_URL not set; presence, caches and rate limiting disabled');
    }
    return undefined;
  }

  // One retry and a short timeout keep callers fail-fast while Redis is down,
  // instead of queueing requests behind the reconnect loop.
  const client = new IORedis(url, { maxRetriesPerRequest: 1, commandTimeout: 500 });
  client.on('error', (err: unknown) => logger.warn({ err }, 'Redis connection error'));
  _redis = new JsonRedis(client);
  return _redis;
}

/** Closes the connection so shutdown does not wait on an open socket. */
export async function closeRedis(): Promise<void> {
  if (!_redis) return;
  const { client } = _redis;
  _redis = undefined;
  await client.quit();
}
