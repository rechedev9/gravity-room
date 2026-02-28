/**
 * program-cache unit tests — verify fail-open Redis cache behavior.
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

let redisAvailable = true;

mock.module('./redis', () => ({
  getRedis: (): unknown =>
    redisAvailable ? { get: mockGet, set: mockSet, del: mockDel } : undefined,
}));

// Must import AFTER mock.module
import { getCachedInstance, setCachedInstance, invalidateCachedInstance } from './program-cache';

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
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGet.mockClear();
  mockSet.mockClear();
  mockDel.mockClear();
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
    // Arrange
    mockGet.mockResolvedValueOnce(JSON.stringify(CACHED_RESPONSE));

    // Act
    const result = await getCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(result).toEqual(CACHED_RESPONSE);
  });

  it('evicts and returns undefined on corrupt data (not an object)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce('"just a string"');

    // Act
    const result = await getCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(result).toBeUndefined();
    expect(mockDel).toHaveBeenCalledTimes(1);
  });

  it('evicts and returns undefined on corrupt data (missing id)', async () => {
    // Arrange
    mockGet.mockResolvedValueOnce(JSON.stringify({ name: 'no id field' }));

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
    // Act
    await setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never);

    // Assert
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      `program:${USER_ID}:${INSTANCE_ID}`,
      JSON.stringify(CACHED_RESPONSE),
      'EX',
      300
    );
  });

  it('is a no-op when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    await setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never);

    // Assert
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('swallows errors from redis.set', async () => {
    // Arrange
    mockSet.mockRejectedValueOnce(new Error('write failed'));

    // Act / Assert — should not throw
    await setCachedInstance(USER_ID, INSTANCE_ID, CACHED_RESPONSE as never);
  });
});

describe('invalidateCachedInstance', () => {
  it('calls redis.del with correct key', async () => {
    // Act
    await invalidateCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith(`program:${USER_ID}:${INSTANCE_ID}`);
  });

  it('is a no-op when Redis is not available', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    await invalidateCachedInstance(USER_ID, INSTANCE_ID);

    // Assert
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('swallows errors from redis.del', async () => {
    // Arrange
    mockDel.mockRejectedValueOnce(new Error('delete failed'));

    // Act / Assert — should not throw
    await invalidateCachedInstance(USER_ID, INSTANCE_ID);
  });
});
