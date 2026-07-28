/**
 * program-cache unit tests — verify fail-open Redis cache behavior.
 *
 * Mocks getRedis() to control Redis availability. Each test exercises a
 * specific cache scenario: miss, hit, corruption, Redis errors, no Redis.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Redis client
// ---------------------------------------------------------------------------

const mockGet = vi.fn<(key: string) => Promise<unknown>>(() => Promise.resolve(null));
const mockDel = vi.fn(() => Promise.resolve(1));
const mockEval = vi.fn<
  (script: string, keys: string[], args: readonly string[]) => Promise<unknown>
>(() => Promise.resolve(1));

let redisAvailable = true;

vi.mock('./redis', () => ({
  getRedis: (): unknown =>
    redisAvailable ? { get: mockGet, del: mockDel, eval: mockEval } : undefined,
}));

// Must import AFTER mock.module
import {
  beginCachedInstanceFill,
  completeCachedInstanceFill,
  getCachedInstance,
  setCachedInstance,
  invalidateCachedInstance,
  invalidateCachedInstances,
} from './program-cache';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-1';
const INSTANCE_ID = 'inst-1';

const CACHED_RESPONSE = {
  id: INSTANCE_ID,
  programId: 'gzclp',
  name: 'Test Program',
  config: { squat: 60 },
  metadata: null,
  status: 'active',
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue(null);
  mockDel.mockClear();
  mockEval.mockReset();
  mockEval.mockImplementation(async (script, _keys, args) =>
    script.includes('return ARGV[1]') ? (args[0] ?? '') : 1
  );
  redisAvailable = true;
});

describe('getCachedInstance', () => {
  it('returns undefined when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    const result = await getCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(result).toBeUndefined();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns undefined on cache miss', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(null);

    // Act
    const result = await getCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(result).toBeUndefined();
  });

  it('returns parsed data on cache hit', async () => {
    // Arrange — Upstash auto-deserializes, so the client returns the object.
    mockGet.mockResolvedValueOnce(CACHED_RESPONSE);

    // Act
    const result = await getCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(result).toEqual(CACHED_RESPONSE);
  });

  it('evicts and returns undefined on corrupt data (not an object)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce('just a string');

    // Act
    const result = await getCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(result).toBeUndefined();
    expect(mockDel).toHaveBeenCalledTimes(1);
  });

  it('evicts and returns undefined on corrupt data (missing id)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce({ name: 'no id field' });

    // Act
    const result = await getCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(result).toBeUndefined();
    expect(mockDel).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when Redis.get throws', async () => {
    // Arrange
    mockGet.mockRejectedValueOnce(new Error('connection lost'));

    // Act
    const result = await getCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('setCachedInstance', () => {
  it('calls redis.set with correct key and TTL', async () => {
    const fill = await beginCachedInstanceFill(USER_ID);
    mockEval.mockClear();

    // Act
    await setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never, {
      ...fill,
      generation: '7',
      redisAvailable: true,
    });

    // Assert
    expect(mockEval).toHaveBeenCalledTimes(1);
    expect(mockEval.mock.calls[0]?.[1]).toEqual([
      `program-cache-generation:${USER_ID}`,
      `program:${USER_ID}:${INSTANCE_ID}`,
    ]);
    expect(mockEval.mock.calls[0]?.[2]).toEqual(['7', JSON.stringify(CACHED_RESPONSE), '300']);
  });

  it('is a no-op when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;
    const fill = await beginCachedInstanceFill(USER_ID);

    // Act
    await setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never, fill);

    // Assert
    expect(mockEval).not.toHaveBeenCalled();
  });

  it('swallows errors from redis.set', async () => {
    // Arrange
    const fill = await beginCachedInstanceFill(USER_ID);
    mockEval.mockRejectedValueOnce(new Error('write failed'));

    // Act / Assert — should not throw
    await setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never, fill);
  });
});

describe('invalidateCachedInstance', () => {
  it('calls redis.del with correct key', async () => {
    // Act
    await invalidateCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(mockEval).toHaveBeenCalledTimes(1);
    expect(mockEval.mock.calls[0]?.[1]).toEqual([
      `program-cache-generation:${USER_ID}`,
      `program:${USER_ID}:${INSTANCE_ID}`,
    ]);
    expect(mockEval.mock.calls[0]?.[0]).toContain(
      "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])"
    );
    expect(mockEval.mock.calls[0]?.[2]).toEqual([expect.any(String), '3600']);
  });

  it('is a no-op when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    await invalidateCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(mockEval).not.toHaveBeenCalled();
  });

  it('swallows errors from redis.del', async () => {
    // Arrange
    mockEval.mockRejectedValueOnce(new Error('delete failed'));

    // Act / Assert — should not throw
    await invalidateCachedInstance(USER_ID, INSTANCE_ID);
  });
});

describe('invalidateCachedInstances', () => {
  it('evicts the target and every displaced instance with duplicate IDs collapsed', async () => {
    await invalidateCachedInstances(USER_ID, [INSTANCE_ID, 'inst-2', INSTANCE_ID]);

    expect(mockEval).toHaveBeenCalledOnce();
    expect(mockEval.mock.calls[0]?.[1]).toEqual([
      `program-cache-generation:${USER_ID}`,
      `program:${USER_ID}:${INSTANCE_ID}`,
      `program:${USER_ID}:inst-2`,
    ]);
  });

  it('does not call Redis for an empty affected set', async () => {
    await invalidateCachedInstances(USER_ID, []);

    expect(mockEval).not.toHaveBeenCalled();
  });

  it('swallows a bulk eviction failure', async () => {
    mockEval.mockRejectedValueOnce(new Error('bulk delete failed'));

    await expect(
      invalidateCachedInstances(USER_ID, [INSTANCE_ID, 'inst-2'])
    ).resolves.toBeUndefined();
  });
});

describe('distributed stale-fill barrier', () => {
  it('advances the process-local flight generation even without Redis', async () => {
    const ownerUserId = 'user-local-flight';
    redisAvailable = false;
    const before = await beginCachedInstanceFill(ownerUserId);

    await invalidateCachedInstance(ownerUserId, INSTANCE_ID);
    const after = await beginCachedInstanceFill(ownerUserId);

    expect(after.flightGeneration).not.toBe(before.flightGeneration);
    completeCachedInstanceFill(ownerUserId, before);
    completeCachedInstanceFill(ownerUserId, after);
    const afterIdle = await beginCachedInstanceFill(ownerUserId);
    expect(afterIdle.localGeneration).toBe(0);
    completeCachedInstanceFill(ownerUserId, afterIdle);
  });

  it('rejects a late fill after another process advances the distributed generation', async () => {
    let generation: string | null = null;
    let cached: unknown = null;
    mockGet.mockImplementation(async (key: string) =>
      key.startsWith('program-cache-generation:') ? generation : cached
    );
    mockEval.mockImplementation(async (script: string, keys: string[], args: readonly string[]) => {
      if (keys.length === 1 && script.includes('return ARGV[1]')) {
        generation ??= args[0] ?? null;
        return generation;
      }
      if (script.includes("redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])")) {
        generation = args[0] ?? null;
        cached = null;
        return keys.length - 1;
      }
      if (String(generation ?? '') !== args[0]) {
        return 0;
      }
      cached = JSON.parse(args[1] ?? 'null');
      return 1;
    });

    const fillA = await beginCachedInstanceFill(USER_ID);
    generation = 'new-generation';
    await setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never, fillA);

    expect(fillA.generation).not.toBe(generation);
    expect(fillA.redisAvailable).toBe(true);
    expect(generation).toBe('new-generation');
    expect(cached).toBeNull();
  });

  it('uses a fresh generation after expiry so an old fill cannot pass an ABA cycle', async () => {
    let generation: string | null = null;
    let cached: unknown = null;
    mockGet.mockImplementation(async (key: string) =>
      key.startsWith('program-cache-generation:') ? generation : cached
    );
    mockEval.mockImplementation(async (script: string, keys: string[], args: readonly string[]) => {
      if (keys.length === 1 && script.includes('return ARGV[1]')) {
        generation ??= args[0] ?? null;
        return generation;
      }
      if (script.includes("redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])")) {
        generation = args[0] ?? null;
        cached = null;
        return keys.length - 1;
      }
      if (String(generation ?? '') !== args[0]) return 0;
      cached = JSON.parse(args[1] ?? 'null');
      return 1;
    });

    const staleFill = await beginCachedInstanceFill(USER_ID);
    await invalidateCachedInstance(USER_ID, INSTANCE_ID);
    const invalidatedGeneration = generation;
    generation = null;
    const currentFill = await beginCachedInstanceFill(USER_ID);

    expect(currentFill.generation).not.toBe(staleFill.generation);
    expect(currentFill.generation).not.toBe(invalidatedGeneration);

    await setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never, staleFill);
    expect(cached).toBeNull();
    completeCachedInstanceFill(USER_ID, currentFill);
  });

  it('rejects a late same-process fill when distributed invalidation fails', async () => {
    const ownerUserId = 'user-failed-invalidation';
    const fill = await beginCachedInstanceFill(ownerUserId);
    mockEval.mockRejectedValueOnce(new Error('redis unavailable'));

    await invalidateCachedInstance(ownerUserId, INSTANCE_ID);
    mockEval.mockClear();
    await setCachedInstance(ownerUserId, INSTANCE_ID, CACHED_RESPONSE as never, fill);

    expect(mockEval).not.toHaveBeenCalled();
  });

  it('does not let an old fill cleanup delete a newer post-invalidation value', async () => {
    const ownerUserId = 'user-overlapping-fill-cleanup';
    const newerResponse = { ...CACHED_RESPONSE, name: 'Newer Program' };
    let generation: string | null = null;
    let cached: string | null = null;
    let overlapTriggered = false;
    mockGet.mockImplementation(async (key: string) =>
      key.startsWith('program-cache-generation:') ? generation : cached
    );
    mockEval.mockImplementation(async (script: string, keys: string[], args: readonly string[]) => {
      if (keys.length === 1 && script.includes('return ARGV[1]')) {
        generation ??= args[0] ?? null;
        return generation;
      }
      if (script.includes("redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])")) {
        generation = args[0] ?? null;
        cached = null;
        return keys.length - 1;
      }
      if (args.length === 2) {
        if (String(generation ?? '') === args[0] && cached === args[1]) {
          cached = null;
          return 1;
        }
        return 0;
      }
      if (String(generation ?? '') !== args[0]) {
        return 0;
      }
      cached = args[1] ?? null;
      if (!overlapTriggered) {
        overlapTriggered = true;
        await invalidateCachedInstance(ownerUserId, INSTANCE_ID);
        const newerFill = await beginCachedInstanceFill(ownerUserId);
        await setCachedInstance(ownerUserId, INSTANCE_ID, newerResponse as never, newerFill);
      }
      return 1;
    });

    const olderFill = await beginCachedInstanceFill(ownerUserId);
    await setCachedInstance(ownerUserId, INSTANCE_ID, CACHED_RESPONSE as never, olderFill);

    expect(JSON.parse(cached ?? 'null')).toEqual(newerResponse);
  });

  it('does not invalidate another owner process-local fill', async () => {
    const ownerA = 'user-owner-a';
    const ownerB = 'user-owner-b';
    const fillA = await beginCachedInstanceFill(ownerA);

    await invalidateCachedInstance(ownerB, 'owner-b-instance');
    mockEval.mockClear();
    await setCachedInstance(ownerA, INSTANCE_ID, CACHED_RESPONSE as never, fillA);

    expect(mockEval).toHaveBeenCalledOnce();
    expect(mockEval.mock.calls[0]?.[1]).toEqual([
      `program-cache-generation:${ownerA}`,
      `program:${ownerA}:${INSTANCE_ID}`,
    ]);
  });

  it('skips fills when the generation read fails while mutations remain fail-open', async () => {
    mockGet.mockRejectedValueOnce(new Error('redis unavailable'));
    const fill = await beginCachedInstanceFill(USER_ID);

    await expect(
      setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never, fill)
    ).resolves.toBeUndefined();
    mockEval.mockRejectedValueOnce(new Error('redis unavailable'));
    await expect(invalidateCachedInstances(USER_ID, [INSTANCE_ID])).resolves.toBeUndefined();

    expect(fill.redisAvailable).toBe(false);
  });
});
