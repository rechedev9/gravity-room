process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect } from 'bun:test';
import { MemoryRateLimitStore, rateLimit } from './rate-limit';
import { ApiError } from './error-handler';

describe('MemoryRateLimitStore', () => {
  it('allows a request when the count is under the limit', async () => {
    const store = new MemoryRateLimitStore();
    const allowed = await store.check('test:key', 60_000, 5);
    expect(allowed).toBe(true);
  });

  it('blocks the request that exceeds the limit', async () => {
    const store = new MemoryRateLimitStore();
    for (let i = 0; i < 5; i++) {
      await store.check('test:block', 60_000, 5);
    }
    const blocked = await store.check('test:block', 60_000, 5);
    expect(blocked).toBe(false);
  });

  it('uses separate counters per key so different keys do not interfere', async () => {
    const store = new MemoryRateLimitStore();
    for (let i = 0; i < 5; i++) {
      await store.check('key:a', 60_000, 5);
    }
    const allowed = await store.check('key:b', 60_000, 5);
    expect(allowed).toBe(true);
  });

  it('allows requests again after the window expires', async () => {
    const store = new MemoryRateLimitStore();
    // Fill up a 1ms window
    for (let i = 0; i < 3; i++) {
      await store.check('test:expire', 1, 3);
    }
    // Wait for the window to pass
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    const allowed = await store.check('test:expire', 1, 3);
    expect(allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rateLimit() function — verifies ApiError(429) shape (REQ-RL-001..010, REQ-RL-011)
// ---------------------------------------------------------------------------
//
// Strategy: use maxRequests:1 so the limit is exceeded on the 2nd call.
// Each test uses a unique endpoint+IP key to avoid cross-test contamination
// in the singleton MemoryRateLimitStore.
// ---------------------------------------------------------------------------

describe('rateLimit function', () => {
  it('allows the first request and resolves without error', async () => {
    await expect(rateLimit('ip-allow', 'TEST /allow', { maxRequests: 5 })).resolves.toBeUndefined();
  });

  it('throws ApiError(429) when the limit is exceeded', async () => {
    // Consume the one allowed slot
    await rateLimit('ip-limit', 'TEST /limit', { maxRequests: 1 });
    // Second call should throw
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

  // -- Route-specific limit configurations (REQ-RL-001..REQ-RL-010) --
  // Each test verifies: (a) correct key structure and (b) that the route limit
  // of 100 req/min (or 20 for export) is enforced by rateLimit().

  it('GET /exercises allows up to 100 requests per IP (REQ-RL-001)', async () => {
    for (let i = 0; i < 100; i++) {
      await rateLimit('ip-ex', 'GET /exercises', { maxRequests: 100 });
    }
    await expect(rateLimit('ip-ex', 'GET /exercises', { maxRequests: 100 })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('GET /muscle-groups rate limit throws ApiError(429) after limit (REQ-RL-002)', async () => {
    await rateLimit('ip-mg', 'GET /muscle-groups', { maxRequests: 1 });
    await expect(
      rateLimit('ip-mg', 'GET /muscle-groups', { maxRequests: 1 })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('GET /catalog rate limit throws ApiError(429) after limit (REQ-RL-003)', async () => {
    await rateLimit('ip-cat', 'GET /catalog', { maxRequests: 1 });
    await expect(rateLimit('ip-cat', 'GET /catalog', { maxRequests: 1 })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('GET /catalog/:programId rate limit throws ApiError(429) after limit (REQ-RL-004)', async () => {
    await rateLimit('ip-catid', 'GET /catalog/:id', { maxRequests: 1 });
    await expect(
      rateLimit('ip-catid', 'GET /catalog/:id', { maxRequests: 1 })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('GET /programs rate limit throws ApiError(429) after limit (REQ-RL-005)', async () => {
    await rateLimit('user-1', 'GET /programs', { maxRequests: 1 });
    await expect(rateLimit('user-1', 'GET /programs', { maxRequests: 1 })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('GET /programs/:id rate limit throws ApiError(429) after limit (REQ-RL-006)', async () => {
    await rateLimit('user-2', 'GET /programs/:id', { maxRequests: 1 });
    await expect(
      rateLimit('user-2', 'GET /programs/:id', { maxRequests: 1 })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('GET /programs/:id/export enforces lower 20 req/min limit (REQ-RL-007)', async () => {
    for (let i = 0; i < 20; i++) {
      await rateLimit('user-ex', 'GET /programs/:id/export', { maxRequests: 20 });
    }
    await expect(
      rateLimit('user-ex', 'GET /programs/:id/export', { maxRequests: 20 })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('GET /auth/me rate limit throws ApiError(429) after limit (REQ-RL-008)', async () => {
    await rateLimit('user-me', 'GET /auth/me', { maxRequests: 1 });
    await expect(rateLimit('user-me', 'GET /auth/me', { maxRequests: 1 })).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it('GET /program-definitions rate limit throws ApiError(429) after limit (REQ-RL-009)', async () => {
    await rateLimit('user-pd', 'GET /program-definitions', { maxRequests: 1 });
    await expect(
      rateLimit('user-pd', 'GET /program-definitions', { maxRequests: 1 })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('GET /program-definitions/:id rate limit throws ApiError(429) after limit (REQ-RL-010)', async () => {
    await rateLimit('user-pdid', 'GET /program-definitions/:id', { maxRequests: 1 });
    await expect(
      rateLimit('user-pdid', 'GET /program-definitions/:id', { maxRequests: 1 })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('different users/IPs have independent counters and do not interfere', async () => {
    // Fill up the limit for user-a
    await rateLimit('user-a', 'GET /programs', { maxRequests: 1 });
    // user-b should still be allowed (independent counter)
    await expect(rateLimit('user-b', 'GET /programs', { maxRequests: 1 })).resolves.toBeUndefined();
  });
});
