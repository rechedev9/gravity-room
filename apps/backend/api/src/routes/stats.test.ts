/**
 * stats route unit tests — GET /stats/online.
 *
 * The route is fail-soft: it returns { count: null } when Redis is not
 * configured or when the presence count fails, and { count: N } otherwise.
 * Redis, presence, and rate limiting are mocked; the route is mounted on a
 * bare Elysia app with the same onError mapping production uses.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be registered BEFORE importing the tested module
// ---------------------------------------------------------------------------

const { mockRateLimit, mockGetRedis, mockCountOnlineUsers } = vi.hoisted(() => ({
  mockRateLimit: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  mockGetRedis: vi.fn((): unknown => undefined),
  mockCountOnlineUsers: vi.fn<() => Promise<number>>(() => Promise.resolve(0)),
}));

vi.mock('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('../lib/redis', () => ({
  getRedis: mockGetRedis,
}));

vi.mock('../lib/presence', () => ({
  countOnlineUsers: mockCountOnlineUsers,
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { statsRoutes } from './stats';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

const testApp = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code };
    }
    set.status = 500;
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  .use(statsRoutes);

function getOnline(): Promise<Response> {
  return testApp.handle(new Request('http://localhost/stats/online'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /stats/online', () => {
  beforeEach(() => {
    mockRateLimit.mockReset().mockImplementation(() => Promise.resolve());
    mockGetRedis.mockReset().mockImplementation((): unknown => undefined);
    mockCountOnlineUsers.mockReset().mockImplementation(() => Promise.resolve(0));
  });

  it('returns { count: null } when Redis is not configured', async () => {
    // Arrange — default mockGetRedis returns undefined

    // Act
    const res = await getOnline();
    const body = (await res.json()) as { count: number | null };

    // Assert
    expect(res.status).toBe(200);
    expect(body).toEqual({ count: null });
    expect(mockCountOnlineUsers).not.toHaveBeenCalled();
  });

  it('returns { count: N } when the presence count succeeds', async () => {
    // Arrange
    mockGetRedis.mockImplementation((): unknown => ({}));
    mockCountOnlineUsers.mockImplementation(() => Promise.resolve(7));

    // Act
    const res = await getOnline();
    const body = (await res.json()) as { count: number | null };

    // Assert
    expect(res.status).toBe(200);
    expect(body).toEqual({ count: 7 });
    expect(mockCountOnlineUsers).toHaveBeenCalledTimes(1);
  });

  it('returns { count: 0 } (not null) when nobody is online', async () => {
    // Arrange
    mockGetRedis.mockImplementation((): unknown => ({}));
    mockCountOnlineUsers.mockImplementation(() => Promise.resolve(0));

    // Act
    const res = await getOnline();
    const body = (await res.json()) as { count: number | null };

    // Assert
    expect(res.status).toBe(200);
    expect(body).toEqual({ count: 0 });
  });

  it('swallows Redis errors and returns { count: null }', async () => {
    // Arrange
    mockGetRedis.mockImplementation((): unknown => ({}));
    mockCountOnlineUsers.mockImplementation(() => Promise.reject(new Error('connection lost')));

    // Act
    const res = await getOnline();
    const body = (await res.json()) as { count: number | null };

    // Assert — the failure degrades to null, never a 5xx
    expect(res.status).toBe(200);
    expect(body).toEqual({ count: null });
  });

  it('applies the documented rate limit before touching Redis', async () => {
    // Act
    await getOnline();

    // Assert
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    expect(mockRateLimit).toHaveBeenCalledWith(expect.any(String), 'GET /stats/online', {
      maxRequests: 30,
      windowMs: 60_000,
    });
  });

  it('propagates a rate-limit rejection as an error response', async () => {
    // Arrange
    mockRateLimit.mockImplementation(() =>
      Promise.reject(new ApiError(429, 'Too many requests', 'RATE_LIMIT_EXCEEDED'))
    );

    // Act
    const res = await getOnline();
    const body = (await res.json()) as { code: string };

    // Assert — over-limit requests never reach Redis
    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(mockGetRedis).not.toHaveBeenCalled();
  });
});
