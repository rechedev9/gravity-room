/**
 * Redis cache layer for ProgramInstanceResponse.
 * Fail-open: if Redis is unavailable or errors, the app continues without cache.
 */
import { getRedis } from './redis';
import { logger } from './logger';
import { isRecord } from '@gzclp/shared/type-guards';
import type { ProgramInstanceResponse } from '../services/programs';

const CACHE_TTL_SECONDS = 300; // 5 minutes — writes actively invalidate, so longer TTL is safe

/** Minimal shape check — the data was serialized by us, so id presence suffices. */
function isProgramInstanceResponse(value: unknown): value is ProgramInstanceResponse {
  return isRecord(value) && typeof value['id'] === 'string';
}

function cacheKey(userId: string, instanceId: string): string {
  return `program:${userId}:${instanceId}`;
}

/** Returns cached response or undefined on miss / no Redis / error. */
export async function getCachedInstance(
  userId: string,
  instanceId: string
): Promise<ProgramInstanceResponse | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;

  try {
    const raw = await redis.get(cacheKey(userId, instanceId));
    if (!raw) return undefined;

    const parsed: unknown = JSON.parse(raw);

    // Validate shape — if corrupted, evict and treat as miss
    if (!isProgramInstanceResponse(parsed)) {
      logger.warn({ userId, instanceId }, 'program-cache: corrupt entry, evicting');
      await redis.del(cacheKey(userId, instanceId));
      return undefined;
    }

    return parsed;
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceId }, 'program-cache: get failed');
    return undefined;
  }
}

/** Writes response to cache. No-op if Redis unavailable or on error. */
export async function setCachedInstance(
  userId: string,
  instanceId: string,
  response: ProgramInstanceResponse
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(
      cacheKey(userId, instanceId),
      JSON.stringify(response),
      'EX',
      CACHE_TTL_SECONDS
    );
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceId }, 'program-cache: set failed');
  }
}

/** Evicts cached entry. No-op if Redis unavailable or on error. */
export async function invalidateCachedInstance(userId: string, instanceId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(cacheKey(userId, instanceId));
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceId }, 'program-cache: invalidate failed');
  }
}
