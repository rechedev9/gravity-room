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

/**
 * Fails fast at startup when Upstash is not configured in production. Called
 * once at module init below; exported for explicit re-checks if ever needed. The
 * env is read here (not at import-time module scope) so a late-populated env -
 * e.g. when this module is imported before the env is wired in some tests or
 * runtimes - is still seen.
 */
/**
 * Resolve the Upstash REST credentials. Prefers the canonical
 * UPSTASH_REDIS_REST_URL/TOKEN, falling back to KV_REST_API_URL/TOKEN — the
 * names the Vercel Upstash integration injects — so the connection works out of
 * the box on Vercel without manually duplicating the secrets.
 */
function resolveRedisCredentials(): { url: string | undefined; token: string | undefined } {
  return {
    url: process.env['UPSTASH_REDIS_REST_URL'] ?? process.env['KV_REST_API_URL'],
    token: process.env['UPSTASH_REDIS_REST_TOKEN'] ?? process.env['KV_REST_API_TOKEN'],
  };
}

export function assertRedisConfigured(): void {
  const { url, token } = resolveRedisCredentials();
  if (process.env['NODE_ENV'] === 'production' && (!url || !token)) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL/KV_REST_API_TOKEN) are required in production'
    );
  }
}

assertRedisConfigured();

let _redis: Redis | undefined;
let _warnedMissing = false;

/**
 * Returns a singleton Upstash Redis client when the REST env is configured, or
 * undefined when running without Redis (development only — production throws at
 * init above). The env is read LAZILY on first call (not at import time) so the
 * client is still built if the vars are populated after this module is imported.
 * The client is connectionless, so construction is cheap; it is cached after the
 * first successful build so it is constructed at most once.
 */
export function getRedis(): Redis | undefined {
  if (_redis) return _redis;

  const { url, token } = resolveRedisCredentials();
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
