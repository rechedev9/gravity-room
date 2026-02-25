/**
 * Redis cache layer for muscle groups.
 * Follows the established catalog-cache.ts pattern.
 * Fail-open: if Redis is unavailable or errors, returns undefined.
 */
import { getRedis } from './redis';
import { logger } from './logger';
import { isRecord } from '@gzclp/shared/type-guards';
import type { MuscleGroupEntry } from '../services/exercises';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TTL for muscle groups cache (static data, rarely changes). */
const CACHE_TTL_SECONDS = 600; // 10 minutes

/** Redis key for the muscle groups list. */
const CACHE_KEY = 'muscle-groups:list';

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Minimal shape check for cached MuscleGroupEntry. */
function isMuscleGroupEntry(value: unknown): value is MuscleGroupEntry {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}

/** Validates that cached data is a MuscleGroupEntry array. */
function isMuscleGroupEntryArray(value: unknown): value is readonly MuscleGroupEntry[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  return isMuscleGroupEntry(value[0]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns cached muscle groups or undefined on miss / no Redis / error. */
export async function getCachedMuscleGroups(): Promise<readonly MuscleGroupEntry[] | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;

  try {
    const raw = await redis.get(CACHE_KEY);
    if (!raw) return undefined;

    const parsed: unknown = JSON.parse(raw);
    if (!isMuscleGroupEntryArray(parsed)) {
      logger.warn('muscle-groups-cache: corrupt entry, evicting');
      await redis.del(CACHE_KEY);
      return undefined;
    }

    return parsed;
  } catch (err: unknown) {
    logger.warn({ err }, 'muscle-groups-cache: get failed');
    return undefined;
  }
}

/** Writes muscle groups to cache. No-op if Redis unavailable or on error. */
export async function setCachedMuscleGroups(entries: readonly MuscleGroupEntry[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(CACHE_KEY, JSON.stringify(entries), 'EX', CACHE_TTL_SECONDS);
  } catch (err: unknown) {
    logger.warn({ err }, 'muscle-groups-cache: set failed');
  }
}
