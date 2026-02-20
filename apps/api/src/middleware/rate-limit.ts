/**
 * Rate limiter — sliding-window, optionally Redis-backed.
 *
 * When REDIS_URL is set the limiter uses a Redis sorted-set Lua script for
 * atomic distributed counting so all API instances share the same counters.
 * When REDIS_URL is absent it falls back to an in-memory sliding-window that
 * is accurate within a single instance (fine for single-instance deployments).
 *
 * NOTE: the in-memory store resets on server restart.
 */
import { ApiError } from './error-handler';
import { logger } from '../lib/logger';
import { rateLimitHitsTotal } from '../lib/metrics';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface RateLimitStore {
  check(key: string, windowMs: number, maxRequests: number): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// In-memory sliding-window implementation
// ---------------------------------------------------------------------------

const windows = new Map<string, number[]>();
let callCount = 0;
const CLEANUP_EVERY_N = 100;

export class MemoryRateLimitStore implements RateLimitStore {
  async check(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (windows.get(key) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= maxRequests) {
      return false;
    }

    timestamps.push(now);
    windows.set(key, timestamps);

    if (++callCount % CLEANUP_EVERY_N === 0) {
      for (const [k, ts] of windows) {
        if (ts.every((t) => t <= cutoff)) windows.delete(k);
      }
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// Store selection — initialised once on first request
// ---------------------------------------------------------------------------

let _storePromise: Promise<RateLimitStore> | undefined;

async function initStore(): Promise<RateLimitStore> {
  if (process.env['REDIS_URL']) {
    try {
      const { RedisRateLimitStore } = await import('./redis-rate-limit');
      const store = new RedisRateLimitStore();
      logger.info('Rate limiter: using Redis store');
      return store;
    } catch (e: unknown) {
      logger.warn({ err: e }, 'Redis rate limiter init failed, falling back to in-memory');
    }
  }
  return new MemoryRateLimitStore();
}

function getStore(): Promise<RateLimitStore> {
  if (!_storePromise) _storePromise = initStore();
  return _storePromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 20;

export async function rateLimit(
  ip: string,
  endpoint: string,
  opts?: { windowMs?: number; maxRequests?: number }
): Promise<void> {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = opts?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const store = await getStore();
  const allowed = await store.check(`rl:${endpoint}:${ip}`, windowMs, maxRequests);
  if (!allowed) {
    rateLimitHitsTotal.inc({ endpoint });
    throw new ApiError(429, 'Too many requests', 'RATE_LIMITED');
  }
}
