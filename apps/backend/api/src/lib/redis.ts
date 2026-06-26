import { Redis } from '@upstash/redis';
import { logger } from './logger';

/**
 * Upstash Redis over the connectionless REST client.
 *
 * Redis is MANDATORY in production: if the Upstash REST env is missing while
 * NODE_ENV=production we throw at module init so the serverless function fails
 * fast on cold start instead of silently degrading. In development without
 * Upstash configured, getRedis() returns undefined and every caller degrades
 * gracefully (presence -> null/zero, caches -> miss, rate limiting -> no-op).
 */

const url = process.env['UPSTASH_REDIS_REST_URL'];
const token = process.env['UPSTASH_REDIS_REST_TOKEN'];

/**
 * Fails fast at startup when Upstash is not configured in production. Called
 * once at module init below; exported for explicit re-checks if ever needed.
 */
export function assertRedisConfigured(): void {
  if (process.env['NODE_ENV'] === 'production' && (!url || !token)) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production'
    );
  }
}

assertRedisConfigured();

let _redis: Redis | undefined;
let _warnedMissing = false;

/**
 * Returns a singleton Upstash Redis client when the REST env is configured, or
 * undefined when running without Redis (development only — production throws at
 * init above). The client is connectionless, so construction is cheap and safe
 * to call per request.
 */
export function getRedis(): Redis | undefined {
  if (_redis) return _redis;

  if (!url || !token) {
    if (!_warnedMissing) {
      _warnedMissing = true;
      logger.warn('Upstash Redis not configured; presence and caches disabled');
    }
    return undefined;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

export type { Redis };
