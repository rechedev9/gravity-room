// slidingWindow is an in-memory fake here; the Lua script runs against a real
// Redis in lib/redis.integration.test.ts.
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';

let redisAvailable = true;
let limiterFailure: Error | undefined;

const counts = new Map<string, number>();

vi.mock('../lib/redis', () => ({
  getRedis: (): unknown =>
    redisAvailable
      ? {
          slidingWindow(opts: {
            key: string;
            limit: number;
            windowMs: number;
            cost: number;
          }): Promise<{ success: boolean; reset: number }> {
            if (limiterFailure) return Promise.reject(limiterFailure);
            const n = (counts.get(opts.key) ?? 0) + opts.cost;
            counts.set(opts.key, n);
            return Promise.resolve({ success: n <= opts.limit, reset: Date.now() + opts.windowMs });
          },
        }
      : undefined,
}));

// Must import AFTER mock.module
import { rateLimit } from './rate-limit';
import { ApiError } from './error-handler';

beforeEach(() => {
  counts.clear();
  redisAvailable = true;
  limiterFailure = undefined;
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

  it('sets a Retry-After header derived from the limiter reset timestamp', async () => {
    await rateLimit('ip-retry', 'TEST /retry', { maxRequests: 1, windowMs: 60_000 });
    try {
      await rateLimit('ip-retry', 'TEST /retry', { maxRequests: 1, windowMs: 60_000 });
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiError);
      // reset = now + 60_000 ms, so the seconds-until-reset rounds up to 60.
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

  it('charges weighted operations by their declared cost', async () => {
    await rateLimit('user-weighted', 'POST /programs/import:rows', {
      maxRequests: 10,
      cost: 6,
      failClosed: true,
    });
    await expect(
      rateLimit('user-weighted', 'POST /programs/import:rows', {
        maxRequests: 10,
        cost: 5,
        failClosed: true,
      })
    ).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid weighted cost %s',
    async (cost) => {
      await expect(rateLimit('user-invalid-cost', 'POST /weighted', { cost })).rejects.toThrow(
        'Rate-limit cost must be a positive safe integer'
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Dev no-op — when Redis is not configured the limiter never throws
// ---------------------------------------------------------------------------

describe('rateLimit without Redis (dev no-op)', () => {
  it('permits every request when getRedis() returns undefined', async () => {
    redisAvailable = false;
    await rateLimit('ip-noop', 'TEST /noop', { maxRequests: 1 });
    await expect(rateLimit('ip-noop', 'TEST /noop', { maxRequests: 1 })).resolves.toBeUndefined();
  });
});

describe('rateLimit backend failures', () => {
  it('remains fail-open by default for ordinary API availability', async () => {
    limiterFailure = new Error('Redis unavailable');
    await expect(rateLimit('ip-open', 'GET /catalog')).resolves.toBeUndefined();
  });

  it('fails closed with 503 for credential-accepting endpoints', async () => {
    limiterFailure = new Error('Redis unavailable');

    try {
      await rateLimit('ip-closed', 'POST /auth/login', { failClosed: true });
      expect.unreachable('expected fail-closed rate limiter to reject');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(503);
      expect((error as ApiError).code).toBe('RATE_LIMIT_UNAVAILABLE');
      expect((error as ApiError).headers?.['Retry-After']).toBe('5');
    }
  });
});
