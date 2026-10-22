// Sliding-window limiter on Redis, keyed by client IP and endpoint. Without Redis
// (development only) it is a permissive no-op.
import { ApiError } from './error-handler';
import { logger } from '../lib/logger';
import { getRedis, type SlidingWindowResult } from '../lib/redis';

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 20;

export interface RateLimitOptions {
  readonly windowMs?: number;
  readonly maxRequests?: number;
  readonly failClosed?: boolean;
  /** Number of budget tokens consumed by this operation (for weighted work). */
  readonly cost?: number;
}

export async function rateLimit(
  ip: string,
  endpoint: string,
  opts?: RateLimitOptions
): Promise<void> {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = opts?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const cost = opts?.cost ?? 1;
  if (!Number.isSafeInteger(cost) || cost < 1) {
    throw new Error('Rate-limit cost must be a positive safe integer');
  }

  const redis = getRedis();
  if (!redis) return;

  let result: SlidingWindowResult;
  try {
    result = await redis.slidingWindow({
      key: `rl:${endpoint}:${ip}`,
      limit: maxRequests,
      windowMs,
      cost,
    });
  } catch (err) {
    if (opts?.failClosed) {
      logger.error({ err, endpoint }, 'Rate limiter unavailable on fail-closed endpoint');
      throw new ApiError(503, 'Authentication temporarily unavailable', 'RATE_LIMIT_UNAVAILABLE', {
        headers: { 'Retry-After': '5' },
      });
    }
    // Read-only and authenticated resource endpoints remain fail-open for
    // availability. Credential-accepting routes opt into failClosed above so a
    // Redis outage cannot disable brute-force protection.
    logger.warn({ err }, 'Rate limiter: Redis request failed, allowing request (fail-open)');
    return;
  }

  const { success, reset } = result;
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
