/**
 * Redis cache layer for exercise list queries.
 * Follows the established catalog-cache.ts / program-cache.ts pattern.
 * Fail-open: if Redis is unavailable or errors, returns undefined.
 */
import { getRedis } from './redis';
import { logger } from './logger';
import { isRecord } from '@gzclp/shared/type-guards';
import type { ExerciseEntry } from '../services/exercises';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TTL for preset (unauthenticated) exercise queries. */
const PRESET_TTL_SECONDS = 300; // 5 minutes

/** TTL for per-user exercise queries (includes custom exercises). */
const USER_TTL_SECONDS = 120; // 2 minutes

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Minimal shape check for cached ExerciseEntry. */
function isExerciseEntry(value: unknown): value is ExerciseEntry {
  return isRecord(value) && typeof value['id'] === 'string' && typeof value['name'] === 'string';
}

/** Validates that cached data is an ExerciseEntry array. */
function isExerciseEntryArray(value: unknown): value is readonly ExerciseEntry[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  return isExerciseEntry(value[0]);
}

// ---------------------------------------------------------------------------
// Cache key helpers
// ---------------------------------------------------------------------------

/**
 * Builds a deterministic filter hash from the ExerciseFilter object.
 * Keys are sorted alphabetically before JSON.stringify to guarantee
 * the same filter produces the same hash regardless of property order.
 *
 * Filter values that are undefined/empty are omitted so that
 * { q: undefined, level: ['beginner'] } and { level: ['beginner'] }
 * produce the same hash.
 */
export function buildFilterHash(filter: Record<string, unknown>): string {
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(filter).sort()) {
    const val = filter[key];
    if (val === undefined || val === null) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (typeof val === 'string' && val.length === 0) continue;
    // Sort arrays for determinism
    cleaned[key] = Array.isArray(val) ? [...val].sort() : val;
  }
  if (Object.keys(cleaned).length === 0) return '';
  return JSON.stringify(cleaned);
}

function presetKey(filterHash: string): string {
  return `exercises:preset:${filterHash}`;
}

function userKey(userId: string, filterHash: string): string {
  return `exercises:user:${userId}:${filterHash}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns cached exercise list or undefined on miss / no Redis / error. */
export async function getCachedExercises(
  userId: string | undefined,
  filterHash: string
): Promise<readonly ExerciseEntry[] | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;

  const key = userId ? userKey(userId, filterHash) : presetKey(filterHash);

  try {
    const raw = await redis.get(key);
    if (!raw) return undefined;

    const parsed: unknown = JSON.parse(raw);
    if (!isExerciseEntryArray(parsed)) {
      logger.warn('exercise-cache: corrupt entry, evicting');
      await redis.del(key);
      return undefined;
    }

    return parsed;
  } catch (err: unknown) {
    logger.warn({ err }, 'exercise-cache: get failed');
    return undefined;
  }
}

/** Writes exercise list to cache. No-op if Redis unavailable or on error. */
export async function setCachedExercises(
  userId: string | undefined,
  filterHash: string,
  entries: readonly ExerciseEntry[]
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const key = userId ? userKey(userId, filterHash) : presetKey(filterHash);
  const ttl = userId ? USER_TTL_SECONDS : PRESET_TTL_SECONDS;

  try {
    await redis.set(key, JSON.stringify(entries), 'EX', ttl);
  } catch (err: unknown) {
    logger.warn({ err }, 'exercise-cache: set failed');
  }
}

/**
 * Invalidates all user-specific exercise cache keys.
 * Called after POST /exercises (user creates a custom exercise).
 * Uses SCAN to find and delete matching keys (non-blocking).
 * No-op if Redis unavailable or on error.
 */
export async function invalidateUserExercises(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const pattern = `exercises:user:${userId}:*`;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err: unknown) {
    logger.warn({ err, userId }, 'exercise-cache: invalidate failed');
  }
}
