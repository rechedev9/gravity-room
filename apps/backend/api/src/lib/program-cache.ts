/**
 * Redis cache layer for ProgramInstanceResponse.
 * Fail-open: if Redis is unavailable or errors, the app continues without cache.
 */
import { getRedis } from './redis';
import { logger } from './logger';
import { isRecord } from '@gzclp/domain/type-guards';
import type { ProgramInstanceResponse } from '../services/programs';

const CACHE_TTL_SECONDS = 300; // 5 minutes — writes actively invalidate, so longer TTL is safe
// The distributed generation only needs to outlive producers that captured it.
// One hour is well beyond the API's 30-second DB statement ceiling and the
// cache entry lifetime, while preventing a permanent key per historical user.
const GENERATION_TTL_SECONDS = 3_600;
const MISSING_GENERATION = '';

const READ_OR_INITIALIZE_GENERATION_SCRIPT = `
  local current = redis.call('GET', KEYS[1])
  if current then
    return current
  end
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
  return ARGV[1]
`;

const SET_IF_GENERATION_MATCHES_SCRIPT = `
  local current = redis.call('GET', KEYS[1])
  if (current or '') ~= ARGV[1] then
    return 0
  end
  redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
  return 1
`;

const ADVANCE_GENERATION_AND_DELETE_SCRIPT = `
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
  for index = 2, #KEYS do
    redis.call('DEL', KEYS[index])
  end
  return #KEYS - 1
`;

const DELETE_FILL_IF_UNCHANGED_SCRIPT = `
  local currentGeneration = redis.call('GET', KEYS[1])
  if (currentGeneration or '') ~= ARGV[1] then
    return 0
  end
  if redis.call('GET', KEYS[2]) ~= ARGV[2] then
    return 0
  end
  return redis.call('DEL', KEYS[2])
`;

export interface ProgramCacheFill {
  readonly generation: string;
  readonly redisAvailable: boolean;
  readonly localGeneration: number;
  readonly flightGeneration: string;
}

interface LocalGenerationState {
  generation: number;
  activeFills: number;
  activeInvalidations: number;
}

const localGenerationStates = new Map<string, LocalGenerationState>();
const completedFills = new WeakSet<ProgramCacheFill>();

function getOrCreateLocalGenerationState(userId: string): LocalGenerationState {
  const existing = localGenerationStates.get(userId);
  if (existing) return existing;
  const created = { generation: 0, activeFills: 0, activeInvalidations: 0 };
  localGenerationStates.set(userId, created);
  return created;
}

function readLocalGeneration(userId: string): number {
  return localGenerationStates.get(userId)?.generation ?? 0;
}

function deleteIdleLocalGenerationState(userId: string, state: LocalGenerationState): void {
  if (
    state.activeFills === 0 &&
    state.activeInvalidations === 0 &&
    localGenerationStates.get(userId) === state
  ) {
    localGenerationStates.delete(userId);
  }
}

/** Minimal shape check — the data was serialized by us, so id presence suffices. */
function isProgramInstanceResponse(value: unknown): value is ProgramInstanceResponse {
  return isRecord(value) && typeof value['id'] === 'string';
}

function cacheKey(userId: string, instanceId: string): string {
  return `program:${userId}:${instanceId}`;
}

function generationKey(userId: string): string {
  return `program-cache-generation:${userId}`;
}

/**
 * Captures the owner's distributed cache generation immediately before the
 * authoritative DB read. A Redis failure disables this fill; it never falls
 * back to an unguarded write.
 */
export async function beginCachedInstanceFill(userId: string): Promise<ProgramCacheFill> {
  const localState = getOrCreateLocalGenerationState(userId);
  localState.activeFills += 1;
  const capturedLocalGeneration = localState.generation;
  const redis = getRedis();
  if (!redis) {
    return {
      generation: MISSING_GENERATION,
      redisAvailable: false,
      localGeneration: capturedLocalGeneration,
      flightGeneration: `${capturedLocalGeneration}:unavailable`,
    };
  }

  try {
    const generation = await redis.get<unknown>(generationKey(userId));
    if (generation === null || generation === undefined) {
      const initializedGeneration = await redis.eval<[string, string], unknown>(
        READ_OR_INITIALIZE_GENERATION_SCRIPT,
        [generationKey(userId)],
        [crypto.randomUUID(), String(GENERATION_TTL_SECONDS)]
      );
      if (typeof initializedGeneration !== 'number' && typeof initializedGeneration !== 'string') {
        logger.warn({ userId }, 'program-cache: invalid initialized generation, skipping fill');
        return {
          generation: MISSING_GENERATION,
          redisAvailable: false,
          localGeneration: capturedLocalGeneration,
          flightGeneration: `${capturedLocalGeneration}:invalid`,
        };
      }
      const normalizedGeneration = String(initializedGeneration);
      return {
        generation: normalizedGeneration,
        redisAvailable: true,
        localGeneration: capturedLocalGeneration,
        flightGeneration: `${capturedLocalGeneration}:${normalizedGeneration}`,
      };
    }
    if (typeof generation !== 'number' && typeof generation !== 'string') {
      logger.warn({ userId }, 'program-cache: invalid generation, skipping fill');
      return {
        generation: MISSING_GENERATION,
        redisAvailable: false,
        localGeneration: capturedLocalGeneration,
        flightGeneration: `${capturedLocalGeneration}:invalid`,
      };
    }
    return {
      generation: String(generation),
      redisAvailable: true,
      localGeneration: capturedLocalGeneration,
      flightGeneration: `${capturedLocalGeneration}:${String(generation)}`,
    };
  } catch (err: unknown) {
    logger.warn({ err, userId }, 'program-cache: generation read failed');
    return {
      generation: MISSING_GENERATION,
      redisAvailable: false,
      localGeneration: capturedLocalGeneration,
      flightGeneration: `${capturedLocalGeneration}:unavailable`,
    };
  }
}

export function completeCachedInstanceFill(userId: string, fill: ProgramCacheFill): void {
  if (completedFills.has(fill)) return;
  completedFills.add(fill);
  const state = localGenerationStates.get(userId);
  if (!state) return;
  state.activeFills = Math.max(0, state.activeFills - 1);
  deleteIdleLocalGenerationState(userId, state);
}

/** Returns cached response or undefined on miss / no Redis / error. */
export async function getCachedInstance(
  userId: string,
  instanceId: string
): Promise<ProgramInstanceResponse | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;

  try {
    // Upstash automatically deserializes JSON values on read.
    const parsed = await redis.get<unknown>(cacheKey(userId, instanceId));
    if (parsed === null || parsed === undefined) return undefined;

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
  response: ProgramInstanceResponse,
  fill: ProgramCacheFill
): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis || !fill.redisAvailable || fill.localGeneration !== readLocalGeneration(userId)) {
      return;
    }
    const serializedResponse = JSON.stringify(response);
    await redis.eval<[string, string, string], number>(
      SET_IF_GENERATION_MATCHES_SCRIPT,
      [generationKey(userId), cacheKey(userId, instanceId)],
      [fill.generation, serializedResponse, String(CACHE_TTL_SECONDS)]
    );
    if (fill.localGeneration !== readLocalGeneration(userId)) {
      await redis.eval<[string, string], number>(
        DELETE_FILL_IF_UNCHANGED_SCRIPT,
        [generationKey(userId), cacheKey(userId, instanceId)],
        [fill.generation, serializedResponse]
      );
    }
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceId }, 'program-cache: set failed');
  } finally {
    completeCachedInstanceFill(userId, fill);
  }
}

/** Evicts cached entry. No-op if Redis unavailable or on error. */
export async function invalidateCachedInstance(userId: string, instanceId: string): Promise<void> {
  await invalidateCachedInstances(userId, [instanceId]);
}

/**
 * Evicts every affected instance in one post-commit cache operation. Duplicate
 * IDs are collapsed so idempotent active transitions remain cheap.
 */
export async function invalidateCachedInstances(
  userId: string,
  instanceIds: readonly string[]
): Promise<void> {
  const cacheKeys = [...new Set(instanceIds)].map((instanceId) => cacheKey(userId, instanceId));
  if (cacheKeys.length === 0) return;
  const localState = getOrCreateLocalGenerationState(userId);
  localState.generation += 1;
  localState.activeInvalidations += 1;

  const redis = getRedis();
  if (!redis) {
    localState.activeInvalidations -= 1;
    deleteIdleLocalGenerationState(userId, localState);
    return;
  }

  try {
    await redis.eval<[string, string], number>(
      ADVANCE_GENERATION_AND_DELETE_SCRIPT,
      [generationKey(userId), ...cacheKeys],
      [crypto.randomUUID(), String(GENERATION_TTL_SECONDS)]
    );
  } catch (err: unknown) {
    logger.warn({ err, userId, instanceIds }, 'program-cache: invalidate failed');
  } finally {
    localState.activeInvalidations -= 1;
    deleteIdleLocalGenerationState(userId, localState);
  }
}
