/**
 * Rate limiter — sliding-window, backed by Upstash Redis over REST.
 *
 * Distributed counting via @upstash/ratelimit so every serverless invocation
 * shares the same window. A Ratelimit instance is constructed and cached per
 * distinct {windowMs, maxRequests} configuration. Keys are the caller-supplied
 * client IP (derived upstream from x-forwarded-for) scoped by endpoint.
 *
 * In development without Upstash configured, getRedis() returns undefined and
 * the limiter degrades to a permissive no-op (logged once) — it never crashes
 * dev. Redis is mandatory in production (enforced at lib/redis.ts module init).
 */
import { Ratelimit } from '@upstash/ratelimit';
import { ApiError } from './error-handler';
import { logger } from '../lib/logger';
import { getRedis } from '../lib/redis';
import { keepAlive } from '../lib/wait-until';

// ---------------------------------------------------------------------------
// Limiter cache — one Ratelimit per distinct {windowMs, maxRequests}
// ---------------------------------------------------------------------------

const limiters = new Map<string, Ratelimit>();
let _warnedNoRedis = false;

function getLimiter(windowMs: number, maxRequests: number): Ratelimit | undefined {
  const redis = getRedis();
  if (!redis) {
    if (!_warnedNoRedis) {
      _warnedNoRedis = true;
      logger.warn('Rate limiter: Upstash not configured, limiting is a no-op');
    }
    return undefined;
  }

  const cacheKey = `${windowMs}:${maxRequests}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      prefix: 'rl',
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
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

  const limiter = getLimiter(windowMs, maxRequests);
  if (!limiter) return; // dev no-op: permissive when Upstash is absent

  let result: Awaited<ReturnType<typeof limiter.limit>>;
  try {
    result = await limiter.limit(`${endpoint}:${ip}`);
  } catch (err) {
    // A transient Upstash REST failure must not turn every rate-limited request
    // into a 500 (regression vs the old in-memory fallback). Fail OPEN: log and
    // allow the request through. Only an actual over-limit throws below.
    logger.warn({ err }, 'Rate limiter: Upstash request failed, allowing request (fail-open)');
    return;
  }

  const { success, reset, pending } = result;
  // @upstash/ratelimit performs background multi-region sync / analytics on the
  // `pending` promise. On Vercel the function may freeze once the Response is
  // returned, dropping that work, so keep it alive until it settles. The
  // synchronous allow/deny decision below is unaffected.
  keepAlive(pending);
  if (!success) {
    // Retry-After is the seconds until THIS limiter window resets (from the
    // limiter's reset timestamp), not the full window length, so clients are not
    // told to wait longer than necessary.
    const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    throw new ApiError(429, 'Too many requests', 'RATE_LIMITED', {
      headers: { 'Retry-After': String(retryAfter) },
    });
  }
}
