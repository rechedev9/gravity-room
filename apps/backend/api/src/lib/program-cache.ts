/**
 * Generational Redis cache for ProgramInstanceResponse.
 *
 * A mutation increments a generation key. Reads and writes are scoped to the
 * generation captured before the DB fetch, so a slow pre-mutation GET may write
 * an old-generation key but can never repopulate the generation subsequent
 * requests read. Old generations expire naturally.
 */
import { getRedis } from './redis';
import { logger } from './logger';
import { isRecord } from '@gzclp/domain/type-guards';
import type { ProgramInstanceResponse } from '../services/programs';

const CACHE_TTL_SECONDS = 300;

export interface ProgramCacheSnapshot {
  readonly generation: number;
  readonly value: ProgramInstanceResponse | undefined;
}

function isProgramInstanceResponse(value: unknown): value is ProgramInstanceResponse {
  return isRecord(value) && typeof value['id'] === 'string';
}

function generationKey(userId: string, instanceId: string): string {
  return `program-generation:${userId}:${instanceId}`;
}

function cacheKey(userId: string, instanceId: string, generation: number): string {
  return `program:${userId}:${instanceId}:g${generation}`;
}

export async function getProgramCacheGeneration(
  userId: string,
  instanceId: string
): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const value = await redis.get<unknown>(generationKey(userId, instanceId));
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceId }, 'program-cache: generation get failed');
    return 0;
  }
}

async function getAtGeneration(
  userId: string,
  instanceId: string,
  generation: number
): Promise<ProgramInstanceResponse | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;
  const key = cacheKey(userId, instanceId, generation);
  try {
    const parsed = await redis.get<unknown>(key);
    if (parsed === null || parsed === undefined) return undefined;
    if (!isProgramInstanceResponse(parsed)) {
      logger.warn({ userId, instanceId, generation }, 'program-cache: corrupt entry, evicting');
      await redis.del(key);
      return undefined;
    }
    return parsed;
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceId, generation }, 'program-cache: get failed');
    return undefined;
  }
}

export async function getProgramCacheSnapshot(
  userId: string,
  instanceId: string
): Promise<ProgramCacheSnapshot> {
  const generation = await getProgramCacheGeneration(userId, instanceId);
  return { generation, value: await getAtGeneration(userId, instanceId, generation) };
}

/** Backward-compatible convenience for callers that do not need the generation. */
export async function getCachedInstance(
  userId: string,
  instanceId: string
): Promise<ProgramInstanceResponse | undefined> {
  return (await getProgramCacheSnapshot(userId, instanceId)).value;
}

export async function setCachedInstance(
  userId: string,
  instanceId: string,
  response: ProgramInstanceResponse,
  generation?: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const targetGeneration = generation ?? (await getProgramCacheGeneration(userId, instanceId));
  try {
    await redis.set(cacheKey(userId, instanceId, targetGeneration), response, {
      ex: CACHE_TTL_SECONDS,
    });
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceId, targetGeneration }, 'program-cache: set failed');
  }
}

/** Advance the generation; stale in-flight writes remain unreachable. */
export async function invalidateCachedInstance(userId: string, instanceId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(generationKey(userId, instanceId));
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceId }, 'program-cache: invalidate failed');
  }
}
