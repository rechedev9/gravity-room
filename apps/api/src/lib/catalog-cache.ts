/**
 * Redis cache layer for catalog data (program list and definitions).
 * Follows the existing program-cache.ts pattern.
 * Fail-open: if Redis is unavailable or errors, returns undefined.
 */
import { getRedis } from './redis';
import { logger } from './logger';
import { isRecord } from '@gzclp/shared/type-guards';
import type { ProgramDefinition } from '@gzclp/shared/types/program';

const CACHE_TTL_SECONDS = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Catalog list cache
// ---------------------------------------------------------------------------

const CATALOG_LIST_KEY = 'catalog:list';

/** Returns cached catalog list or undefined on miss / no Redis / error. */
export async function getCachedCatalogList(): Promise<unknown> {
  const redis = getRedis();
  if (!redis) return undefined;

  try {
    const raw = await redis.get(CATALOG_LIST_KEY);
    if (!raw) return undefined;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      logger.warn('catalog-cache: corrupt list entry, evicting');
      await redis.del(CATALOG_LIST_KEY);
      return undefined;
    }

    return parsed;
  } catch (err: unknown) {
    logger.warn({ err }, 'catalog-cache: list get failed');
    return undefined;
  }
}

/** Writes catalog list to cache. No-op if Redis unavailable or on error. */
export async function setCachedCatalogList(
  entries: ReadonlyArray<{ readonly id: string }>
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(CATALOG_LIST_KEY, JSON.stringify(entries), 'EX', CACHE_TTL_SECONDS);
  } catch (err: unknown) {
    logger.warn({ err }, 'catalog-cache: list set failed');
  }
}

// ---------------------------------------------------------------------------
// Catalog detail cache
// ---------------------------------------------------------------------------

function detailKey(programId: string): string {
  return `catalog:detail:${programId}`;
}

/** Minimal shape check for ProgramDefinition. */
function isProgramDefinition(value: unknown): value is ProgramDefinition {
  return isRecord(value) && typeof value['id'] === 'string' && Array.isArray(value['days']);
}

/** Returns cached program definition or undefined on miss / no Redis / error. */
export async function getCachedCatalogDetail(
  programId: string
): Promise<ProgramDefinition | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;

  try {
    const raw = await redis.get(detailKey(programId));
    if (!raw) return undefined;

    const parsed: unknown = JSON.parse(raw);
    if (!isProgramDefinition(parsed)) {
      logger.warn({ programId }, 'catalog-cache: corrupt detail entry, evicting');
      await redis.del(detailKey(programId));
      return undefined;
    }

    return parsed;
  } catch (err: unknown) {
    logger.warn({ err, programId }, 'catalog-cache: detail get failed');
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

/** Evicts the catalog list cache entry. No-op if Redis unavailable. */
export async function invalidateCatalogList(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(CATALOG_LIST_KEY);
  } catch (err: unknown) {
    logger.warn({ err }, 'catalog-cache: list invalidation failed');
  }
}

/** Evicts a specific catalog detail cache entry. No-op if Redis unavailable. */
export async function invalidateCatalogDetail(programId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(detailKey(programId));
  } catch (err: unknown) {
    logger.warn({ err, programId }, 'catalog-cache: detail invalidation failed');
  }
}

/** Writes program definition to cache. No-op if Redis unavailable or on error. */
export async function setCachedCatalogDetail(
  programId: string,
  definition: ProgramDefinition
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(detailKey(programId), JSON.stringify(definition), 'EX', CACHE_TTL_SECONDS);
  } catch (err: unknown) {
    logger.warn({ err, programId }, 'catalog-cache: detail set failed');
  }
}
