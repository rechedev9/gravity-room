/**
 * exercise-cache unit tests — verify fail-open Redis cache behavior,
 * filter hash determinism, and per-user key isolation.
 *
 * Mocks getRedis() to control Redis availability. Each test exercises a
 * specific cache scenario: miss, hit, corruption, Redis errors, no Redis.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock Redis client
// ---------------------------------------------------------------------------

const mockGet = mock(() => Promise.resolve(null as string | null));
const mockSet = mock(() => Promise.resolve('OK'));
const mockDel = mock(() => Promise.resolve(1));
const mockScan = mock(() => Promise.resolve(['0', [] as string[]] as [string, string[]]));

let redisAvailable = true;

mock.module('./redis', () => ({
  getRedis: (): unknown =>
    redisAvailable ? { get: mockGet, set: mockSet, del: mockDel, scan: mockScan } : undefined,
}));

// Must import AFTER mock.module
import {
  buildFilterHash,
  getCachedExercises,
  setCachedExercises,
  invalidateUserExercises,
} from './exercise-cache';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-1';
const FILTER_HASH = 'test-hash';

const CACHED_EXERCISES = [
  {
    id: 'squat',
    name: 'Squat',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
    isPreset: true,
    createdBy: null,
    force: null,
    level: null,
    mechanic: null,
    category: null,
    secondaryMuscles: null,
  },
  {
    id: 'bench',
    name: 'Bench Press',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
    isPreset: true,
    createdBy: null,
    force: null,
    level: null,
    mechanic: null,
    category: null,
    secondaryMuscles: null,
  },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGet.mockClear();
  mockSet.mockClear();
  mockDel.mockClear();
  mockScan.mockClear();
  redisAvailable = true;
});

// ---------------------------------------------------------------------------
// Tests: buildFilterHash
// ---------------------------------------------------------------------------

describe('buildFilterHash', () => {
  it('produces identical hash for same filter keys in different insertion order', () => {
    const hashA = buildFilterHash({ level: ['beginner'], muscleGroup: 'chest' });
    const hashB = buildFilterHash({ muscleGroup: 'chest', level: ['beginner'] });

    expect(hashA).toBe(hashB);
  });

  it('produces different hashes for different filters', () => {
    const hashA = buildFilterHash({ level: ['beginner'] });
    const hashB = buildFilterHash({ level: ['advanced'] });

    expect(hashA).not.toBe(hashB);
  });

  it('strips undefined values before hashing', () => {
    const hashA = buildFilterHash({ q: undefined, level: ['beginner'] });
    const hashB = buildFilterHash({ level: ['beginner'] });

    expect(hashA).toBe(hashB);
  });

  it('strips null values before hashing', () => {
    const hashA = buildFilterHash({ q: null, level: ['beginner'] });
    const hashB = buildFilterHash({ level: ['beginner'] });

    expect(hashA).toBe(hashB);
  });

  it('strips empty string values before hashing', () => {
    const hashA = buildFilterHash({ q: '', level: ['beginner'] });
    const hashB = buildFilterHash({ level: ['beginner'] });

    expect(hashA).toBe(hashB);
  });

  it('strips empty array values before hashing', () => {
    const hashA = buildFilterHash({ level: [], muscleGroup: 'chest' });
    const hashB = buildFilterHash({ muscleGroup: 'chest' });

    expect(hashA).toBe(hashB);
  });

  it('sorts array values for determinism', () => {
    const hashA = buildFilterHash({ level: ['advanced', 'beginner'] });
    const hashB = buildFilterHash({ level: ['beginner', 'advanced'] });

    expect(hashA).toBe(hashB);
  });

  it('returns empty string for empty filter', () => {
    expect(buildFilterHash({})).toBe('');
  });

  it('returns empty string when all values are stripped', () => {
    expect(buildFilterHash({ q: undefined, level: null, tags: [] })).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Tests: getCachedExercises
// ---------------------------------------------------------------------------

describe('getCachedExercises', () => {
  it('returns undefined when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    const result = await getCachedExercises(undefined, FILTER_HASH);

    // Assert
    expect(result).toBeUndefined();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns undefined on cache miss (null)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(null);

    // Act
    const result = await getCachedExercises(undefined, FILTER_HASH);

    // Assert
    expect(result).toBeUndefined();
  });

  it('returns cached array on hit', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(JSON.stringify(CACHED_EXERCISES));

    // Act
    const result = await getCachedExercises(undefined, FILTER_HASH);

    // Assert
    expect(result).toEqual(CACHED_EXERCISES);
  });

  it('uses preset key when userId is undefined', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(null);

    // Act
    await getCachedExercises(undefined, FILTER_HASH);

    // Assert
    expect(mockGet).toHaveBeenCalledWith(`exercises:preset:${FILTER_HASH}`);
  });

  it('uses user key when userId is provided', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(null);

    // Act
    await getCachedExercises(USER_ID, FILTER_HASH);

    // Assert
    expect(mockGet).toHaveBeenCalledWith(`exercises:user:${USER_ID}:${FILTER_HASH}`);
  });

  it('returns undefined when Redis.get throws', async () => {
    // Arrange
    mockGet.mockRejectedValueOnce(new Error('connection lost'));

    // Act
    const result = await getCachedExercises(undefined, FILTER_HASH);

    // Assert
    expect(result).toBeUndefined();
  });

  it('evicts and returns undefined on corrupt cache entry (non-array)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce('"not an array"');

    // Act
    const result = await getCachedExercises(undefined, FILTER_HASH);

    // Assert
    expect(result).toBeUndefined();
    expect(mockDel).toHaveBeenCalledTimes(1);
  });

  it('evicts and returns undefined on corrupt entry (missing id field)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(JSON.stringify([{ name: 'no id' }]));

    // Act
    const result = await getCachedExercises(undefined, FILTER_HASH);

    // Assert
    expect(result).toBeUndefined();
    expect(mockDel).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: setCachedExercises
// ---------------------------------------------------------------------------

describe('setCachedExercises', () => {
  it('is a no-op when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    await setCachedExercises(undefined, FILTER_HASH, CACHED_EXERCISES);

    // Assert
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('sets preset key with EX 300 TTL when userId is undefined', async () => {
    // Act
    await setCachedExercises(undefined, FILTER_HASH, CACHED_EXERCISES);

    // Assert
    expect(mockSet).toHaveBeenCalledWith(
      `exercises:preset:${FILTER_HASH}`,
      JSON.stringify(CACHED_EXERCISES),
      'EX',
      300
    );
  });

  it('sets user key with EX 120 TTL when userId is provided', async () => {
    // Act
    await setCachedExercises(USER_ID, FILTER_HASH, CACHED_EXERCISES);

    // Assert
    expect(mockSet).toHaveBeenCalledWith(
      `exercises:user:${USER_ID}:${FILTER_HASH}`,
      JSON.stringify(CACHED_EXERCISES),
      'EX',
      120
    );
  });

  it('swallows errors from redis.set', async () => {
    // Arrange
    mockSet.mockRejectedValueOnce(new Error('write failed'));

    // Act / Assert — should not throw
    await setCachedExercises(undefined, FILTER_HASH, CACHED_EXERCISES);
  });
});

// ---------------------------------------------------------------------------
// Tests: invalidateUserExercises
// ---------------------------------------------------------------------------

describe('invalidateUserExercises', () => {
  it('is a no-op when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    await invalidateUserExercises(USER_ID);

    // Assert
    expect(mockScan).not.toHaveBeenCalled();
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('calls SCAN with the correct user pattern', async () => {
    // Arrange
    mockScan.mockResolvedValueOnce(['0', []]);

    // Act
    await invalidateUserExercises(USER_ID);

    // Assert
    expect(mockScan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      `exercises:user:${USER_ID}:*`,
      'COUNT',
      '100'
    );
  });

  it('DELetes found user keys', async () => {
    // Arrange
    const foundKeys = [`exercises:user:${USER_ID}:hash1`, `exercises:user:${USER_ID}:hash2`];
    mockScan.mockResolvedValueOnce(['0', foundKeys]);

    // Act
    await invalidateUserExercises(USER_ID);

    // Assert
    expect(mockDel).toHaveBeenCalledWith(...foundKeys);
  });

  it('does not delete preset keys', async () => {
    // Arrange — only user keys returned
    mockScan.mockResolvedValueOnce(['0', [`exercises:user:${USER_ID}:abc`]]);

    // Act
    await invalidateUserExercises(USER_ID);

    // Assert — del was called only with the user key, not any preset key
    const delArg = (mockDel.mock.calls[0] as string[] | undefined)?.[0] ?? '';
    expect(delArg).toContain(`exercises:user:${USER_ID}`);
    expect(delArg).not.toContain('exercises:preset');
  });

  it('swallows errors from SCAN', async () => {
    // Arrange
    mockScan.mockRejectedValueOnce(new Error('scan failed'));

    // Act / Assert — should not throw
    await invalidateUserExercises(USER_ID);
  });
});
