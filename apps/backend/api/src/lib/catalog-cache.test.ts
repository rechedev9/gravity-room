/**
 * catalog-cache unit tests — verify fail-open Redis cache behavior
 * for catalog list and detail invalidation functions.
 *
 * Mocks getRedis() to control Redis availability. Each test exercises a
 * specific invalidation scenario: success, no Redis, Redis error.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Redis client
// ---------------------------------------------------------------------------

const mockGet = vi.fn(() => Promise.resolve(null as string | null));
const mockSet = vi.fn(() => Promise.resolve('OK'));
const mockDel = vi.fn(() => Promise.resolve(1));

let redisAvailable = true;

vi.mock('./redis', () => ({
  getRedis: (): unknown =>
    redisAvailable ? { get: mockGet, set: mockSet, del: mockDel } : undefined,
}));

// Mock logger to verify warn calls
const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn((): void => undefined) }));

vi.mock('./logger', () => ({
  logger: {
    info: (): void => undefined,
    warn: mockLoggerWarn,
    error: (): void => undefined,
    debug: (): void => undefined,
  },
}));

// Must import AFTER mock.module
import { invalidateCatalogList, invalidateCatalogDetail } from './catalog-cache';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGet.mockClear();
  mockSet.mockClear();
  mockDel.mockClear();
  mockLoggerWarn.mockClear();
  redisAvailable = true;
});

// ---------------------------------------------------------------------------
// Tests: invalidateCatalogList
// ---------------------------------------------------------------------------

describe('invalidateCatalogList', () => {
  it('deletes the catalog:list Redis key', async () => {
    // Act
    await invalidateCatalogList();

    // Assert
    expect(mockDel).toHaveBeenCalledWith('catalog:list');
  });

  it('is a no-op when getRedis() returns undefined', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    await invalidateCatalogList();

    // Assert
    expect(mockDel).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('logs a warning when redis.del throws', async () => {
    // Arrange
    mockDel.mockRejectedValueOnce(new Error('connection lost'));

    // Act
    await invalidateCatalogList();

    // Assert — function returns without re-throwing
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: invalidateCatalogDetail
// ---------------------------------------------------------------------------

describe('invalidateCatalogDetail', () => {
  it('deletes only the specific catalog:detail:{programId} key', async () => {
    // Act
    await invalidateCatalogDetail('gzclp');

    // Assert
    expect(mockDel).toHaveBeenCalledWith('catalog:detail:gzclp');
    expect(mockDel).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when getRedis() returns undefined', async () => {
    // Arrange
    redisAvailable = false;

    // Act
    await invalidateCatalogDetail('gzclp');

    // Assert
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('logs a warning when redis.del throws', async () => {
    // Arrange
    mockDel.mockRejectedValueOnce(new Error('delete failed'));

    // Act
    await invalidateCatalogDetail('gzclp');

    // Assert — function returns without re-throwing
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});
