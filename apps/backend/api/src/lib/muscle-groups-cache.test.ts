/**
 * muscle-groups-cache unit tests — verify fail-open Redis cache behavior
 * for the static muscle groups list.
 *
 * Mocks getRedis() to control Redis availability. Follows the established
 * program-cache.test.ts and exercise-cache.test.ts pattern.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock Redis client
// ---------------------------------------------------------------------------

const mockGet = mock(() => Promise.resolve(null as string | null));
const mockSet = mock(() => Promise.resolve('OK'));
const mockDel = mock(() => Promise.resolve(1));

let redisAvailable = true;

mock.module('./redis', () => ({
  getRedis: (): unknown =>
    redisAvailable ? { get: mockGet, set: mockSet, del: mockDel } : undefined,
}));

// Must import AFTER mock.module
import { getCachedMuscleGroups, setCachedMuscleGroups } from './muscle-groups-cache';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CACHED_MUSCLE_GROUPS = [
  { id: 'chest', name: 'Pecho' },
  { id: 'back', name: 'Espalda' },
  { id: 'legs', name: 'Piernas' },
];

const CACHE_KEY = 'muscle-groups:list';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGet.mockClear();
  mockSet.mockClear();
  mockDel.mockClear();
  redisAvailable = true;
});

// ---------------------------------------------------------------------------
// Tests: getCachedMuscleGroups
// ---------------------------------------------------------------------------

describe('getCachedMuscleGroups', () => {
  it('returns undefined when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    const result = await getCachedMuscleGroups();

    // Assert
    expect(result).toBeUndefined();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns undefined on cache miss (null)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(null);

    // Act
    const result = await getCachedMuscleGroups();

    // Assert
    expect(result).toBeUndefined();
  });

  it('returns cached array on hit', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(JSON.stringify(CACHED_MUSCLE_GROUPS));

    // Act
    const result = await getCachedMuscleGroups();

    // Assert
    expect(result).toEqual(CACHED_MUSCLE_GROUPS);
  });

  it('evicts and returns undefined on corrupt entry (non-array)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce('"just a string"');

    // Act
    const result = await getCachedMuscleGroups();

    // Assert
    expect(result).toBeUndefined();
    expect(mockDel).toHaveBeenCalledWith(CACHE_KEY);
  });

  it('evicts and returns undefined on corrupt entry (missing id field)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(JSON.stringify([{ name: 'no id field' }]));

    // Act
    const result = await getCachedMuscleGroups();

    // Assert
    expect(result).toBeUndefined();
    expect(mockDel).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when Redis.get throws', async () => {
    // Arrange
    mockGet.mockRejectedValueOnce(new Error('connection lost'));

    // Act
    const result = await getCachedMuscleGroups();

    // Assert
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: setCachedMuscleGroups
// ---------------------------------------------------------------------------

describe('setCachedMuscleGroups', () => {
  it('is a no-op when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    await setCachedMuscleGroups(CACHED_MUSCLE_GROUPS);

    // Assert
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('sets muscle-groups:list key with EX 600 TTL', async () => {
    // Act
    await setCachedMuscleGroups(CACHED_MUSCLE_GROUPS);

    // Assert
    expect(mockSet).toHaveBeenCalledWith(
      CACHE_KEY,
      JSON.stringify(CACHED_MUSCLE_GROUPS),
      'EX',
      600
    );
  });

  it('swallows errors from redis.set', async () => {
    // Arrange
    mockSet.mockRejectedValueOnce(new Error('write failed'));

    // Act / Assert — should not throw
    await setCachedMuscleGroups(CACHED_MUSCLE_GROUPS);
  });
});
