/**
 * rate-limit unit tests — verify the Upstash-backed sliding-window limiter.
 *
 * Strategy: mock @upstash/ratelimit with a deterministic in-memory counter so
 * we can drive the limit/allow decision, and mock ../lib/redis so the limiter
 * believes Upstash is configured. Each test uses a unique endpoint+IP key to
 * avoid cross-test contamination in the module-level limiter cache.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the SUT
// ---------------------------------------------------------------------------

let redisAvailable = true;

mock.module('../lib/redis', () => ({
  // Truthy stub; the mocked Ratelimit below ignores the client entirely.
  getRedis: (): unknown => (redisAvailable ? {} : undefined),
}));

// Per-key hit counter shared across mocked Ratelimit instances.
const counts = new Map<string, number>();

mock.module('@upstash/ratelimit', () => {
  class Ratelimit {
    private readonly max: number;
    constructor(opts: { limiter: { max: number } }) {
      this.max = opts.limiter.max;
    }
    static slidingWindow(max: number): { max: number } {
      return { max };
    }
    limit(key: string): Promise<{ success: boolean }> {
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return Promise.resolve({ success: n <= this.max });
    }
  }
  return { Ratelimit };
});

// Must import AFTER mock.module
import { rateLimit } from './rate-limit';
import { ApiError } from './error-handler';

beforeEach(() => {
  counts.clear();
  redisAvailable = true;
});

// ---------------------------------------------------------------------------
// rateLimit() — ApiError(429) shape (REQ-RL-011) and per-key isolation
// ---------------------------------------------------------------------------

describe('rateLimit function', () => {
  it('allows the first request and resolves without error', async () => {
    await expect(rateLimit('ip-allow', 'TEST /allow', { maxRequests: 5 })).resolves.toBeUndefined();
  });

  it('throws ApiError(429) when the limit is exceeded', async () => {
    await rateLimit('ip-limit', 'TEST /limit', { maxRequests: 1 });
    await expect(rateLimit('ip-limit', 'TEST /limit', { maxRequests: 1 })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('throws with statusCode 429 (REQ-RL-011)', async () => {
    await rateLimit('ip-429', 'TEST /429', { maxRequests: 1 });
    try {
      await rateLimit('ip-429', 'TEST /429', { maxRequests: 1 });
      expect(true).toBe(false); // should not reach
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(429);
    }
  });

  it('throws with code RATE_LIMITED (REQ-RL-011)', async () => {
    await rateLimit('ip-code', 'TEST /code', { maxRequests: 1 });
    try {
      await rateLimit('ip-code', 'TEST /code', { maxRequests: 1 });
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('RATE_LIMITED');
    }
  });

  it('throws with message "Too many requests" (REQ-RL-011)', async () => {
    await rateLimit('ip-msg', 'TEST /msg', { maxRequests: 1 });
    try {
      await rateLimit('ip-msg', 'TEST /msg', { maxRequests: 1 });
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe('Too many requests');
    }
  });

  it('sets a Retry-After header derived from the window', async () => {
    await rateLimit('ip-retry', 'TEST /retry', { maxRequests: 1, windowMs: 60_000 });
    try {
      await rateLimit('ip-retry', 'TEST /retry', { maxRequests: 1, windowMs: 60_000 });
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).headers?.['Retry-After']).toBe('60');
    }
  });

  it('GET /exercises allows up to 100 requests per IP (REQ-RL-001)', async () => {
    for (let i = 0; i < 100; i++) {
      await rateLimit('ip-ex', 'GET /exercises', { maxRequests: 100 });
    }
    await expect(rateLimit('ip-ex', 'GET /exercises', { maxRequests: 100 })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('GET /programs/:id/export enforces lower 20 req/min limit (REQ-RL-007)', async () => {
    for (let i = 0; i < 20; i++) {
      await rateLimit('user-ex', 'GET /programs/:id/export', { maxRequests: 20 });
    }
    await expect(
      rateLimit('user-ex', 'GET /programs/:id/export', { maxRequests: 20 })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('different users/IPs have independent counters and do not interfere', async () => {
    await rateLimit('user-a', 'GET /programs', { maxRequests: 1 });
    await expect(rateLimit('user-b', 'GET /programs', { maxRequests: 1 })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Dev no-op — when Upstash is not configured the limiter never throws
// ---------------------------------------------------------------------------

describe('rateLimit without Upstash (dev no-op)', () => {
  it('permits every request when getRedis() returns undefined', async () => {
    redisAvailable = false;
    await rateLimit('ip-noop', 'TEST /noop', { maxRequests: 1 });
    await expect(rateLimit('ip-noop', 'TEST /noop', { maxRequests: 1 })).resolves.toBeUndefined();
  });
});
