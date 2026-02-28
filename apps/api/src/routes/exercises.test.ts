/**
 * Exercise routes integration tests — auth guard + validation tests using Elysia's .handle().
 * GET /exercises and GET /muscle-groups are public (optional auth).
 * POST /exercises requires auth.
 *
 * JWT auth strategy: build a real HS256 token using the same secret auth-guard.ts captures
 * at module load time. auth-guard reads process.env['JWT_SECRET'] at import time, before
 * any test body code runs. makeValidJwt() reads the SAME env var at CALL time (after module
 * loading but before any override), ensuring both use the same value.
 *
 * IMPORTANT: do NOT assign process.env['JWT_SECRET'] in this file's top-level code —
 * that would override the value AFTER auth-guard already captured it, causing a mismatch.
 */
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

const mockRateLimit = mock((): Promise<void> => Promise.resolve());

mock.module('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

interface PaginatedResult {
  readonly data: readonly Record<string, unknown>[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

const mockListExercises = mock<() => Promise<PaginatedResult>>(() =>
  Promise.resolve({ data: [], total: 0, offset: 0, limit: 100 })
);

mock.module('../services/exercises', () => ({
  listExercises: mockListExercises,
  listMuscleGroups: mock(() => Promise.resolve([])),
  createExercise: mock(() => Promise.resolve({ ok: true, value: { id: 'test_exercise' } })),
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { exerciseRoutes } from './exercises';

// Wrap exerciseRoutes with the same error handler as the main app.
const testApp = new Elysia()
  .onError(({ code, error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code };
    }
    if (code === 'VALIDATION') {
      set.status = 400;
      return { error: 'Validation failed', code: 'VALIDATION_ERROR' };
    }
    set.status = 401;
    return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
  })
  .use(exerciseRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function get(path: string, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(new Request(`http://localhost${path}`, { headers }));
}

function post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

// ---------------------------------------------------------------------------
// GET /exercises — public (optional auth)
// ---------------------------------------------------------------------------

describe('GET /exercises', () => {
  it('returns 200 without auth', async () => {
    const res = await get('/exercises');
    expect(res.status).toBe(200);
  });

  it('returns 200 with filter query params', async () => {
    const res = await get('/exercises?q=squat&equipment=barbell&isCompound=true');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /muscle-groups — public (no auth required)
// ---------------------------------------------------------------------------

describe('GET /muscle-groups', () => {
  it('returns 200 without auth', async () => {
    const res = await get('/muscle-groups');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /exercises — auth required
// ---------------------------------------------------------------------------

describe('POST /exercises without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await post('/exercises', {
      name: 'Bench Press',
      muscleGroupId: 'chest',
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// JWT helper — build a valid HS256 token matching auth-guard's captured secret
// ---------------------------------------------------------------------------
//
// auth-guard.ts captures process.env['JWT_SECRET'] at import time (module evaluation).
// We read the same env var at CALL time (test body execution), which is AFTER all
// modules load but BEFORE any static test-body override of JWT_SECRET.
// Fallback: 'dev-secret-change-me' matches auth-guard's DEV_SECRET constant.
// ---------------------------------------------------------------------------

async function makeValidJwt(userId: string): Promise<string> {
  // Must read at call time — same env state auth-guard captured at import time.
  const secret = process.env['JWT_SECRET'] ?? 'dev-secret-change-me';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const signature = Buffer.from(sig).toString('base64url');
  return `${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// POST /exercises — slug validation (auth-guarded)
// ---------------------------------------------------------------------------

describe('POST /exercises — slug validation', () => {
  it('returns 401 for non-ASCII name (auth checked before slug validation)', async () => {
    const res = await post('/exercises', {
      name: '\u00e7\u00e9\u00e0\u00fc',
      muscleGroupId: 'chest',
    });
    // 401 because auth guard runs before the slug check
    expect(res.status).toBe(401);
  });

  it('returns 422 with INVALID_SLUG when name produces an empty slug', async () => {
    // Arrange — all non-ASCII chars produce empty slug after normalization
    const token = await makeValidJwt('user-1');
    const res = await post(
      '/exercises',
      { name: '\u00e7\u00e9\u00e0\u00fc', muscleGroupId: 'chest' },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    // Assert
    expect(res.status).toBe(422);
    const body: unknown = await res.json();
    expect((body as Record<string, unknown>)['code']).toBe('INVALID_SLUG');
  });

  it('proceeds normally with a mixed ASCII+non-ASCII name that yields a non-empty slug', async () => {
    // Arrange — "abc\u00e9" → slug "abc"
    const token = await makeValidJwt('user-1');
    const res = await post(
      '/exercises',
      { name: 'abc\u00e9', muscleGroupId: 'chest' },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    // Assert — slug "abc" is valid, service mock returns success
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// GET /exercises — filter cap behavior (REQ-SEC-002)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRateLimit.mockClear();
  mockListExercises.mockClear();
  // Restore default paginated response
  mockListExercises.mockImplementation(
    (): Promise<PaginatedResult> => Promise.resolve({ data: [], total: 0, offset: 0, limit: 100 })
  );
});

// ---------------------------------------------------------------------------
// GET /exercises — Cache-Control header (REQ-HTTPCACHE-004)
// ---------------------------------------------------------------------------

describe('GET /exercises — Cache-Control', () => {
  it('unauthenticated request includes Cache-Control: public, max-age=300', async () => {
    // Act
    const res = await get('/exercises');

    // Assert
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('authenticated request does not include public Cache-Control header', async () => {
    // Arrange
    const token = await makeValidJwt('user-1');

    // Act
    const res = await get('/exercises', { Authorization: `Bearer ${token}` });

    // Assert
    const cacheControl = res.headers.get('cache-control');
    expect(cacheControl === null || !cacheControl.includes('public')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /muscle-groups — Cache-Control header (REQ-HTTPCACHE-003)
// ---------------------------------------------------------------------------

describe('GET /muscle-groups — Cache-Control', () => {
  it('includes Cache-Control: public, max-age=600', async () => {
    // Act
    const res = await get('/muscle-groups');

    // Assert
    expect(res.headers.get('cache-control')).toBe('public, max-age=600');
  });
});

// ---------------------------------------------------------------------------
// GET /exercises — rate-limit compound key (REQ-RLSEC-001)
// ---------------------------------------------------------------------------

describe('GET /exercises — rate-limit key', () => {
  it('authenticated request uses compound userId:ip key', async () => {
    // Arrange
    const token = await makeValidJwt('user-1');

    // Act
    await get('/exercises', {
      Authorization: `Bearer ${token}`,
      'x-forwarded-for': '203.0.113.42',
    });

    // Assert — first arg to rateLimit is the key
    const call = mockRateLimit.mock.calls[0] as unknown as [string, string, ...unknown[]];
    expect(call[0]).toBe('user-1:203.0.113.42');
  });

  it('unauthenticated request uses IP-only key', async () => {
    // Act
    await get('/exercises', { 'x-forwarded-for': '198.51.100.1' });

    // Assert
    const call = mockRateLimit.mock.calls[0] as unknown as [string, string, ...unknown[]];
    expect(call[0]).toBe('198.51.100.1');
  });
});

// ---------------------------------------------------------------------------
// GET /exercises — pagination (REQ-EXPAG-001, REQ-EXPAG-002)
// ---------------------------------------------------------------------------

describe('GET /exercises — pagination', () => {
  it('returns paginated envelope with limit and offset', async () => {
    // Arrange
    mockListExercises.mockImplementation(
      (): Promise<PaginatedResult> =>
        Promise.resolve({
          data: [{ id: 'squat', name: 'Squat' }],
          total: 475,
          offset: 0,
          limit: 50,
        })
    );

    // Act
    const res = await get('/exercises?limit=50&offset=0');

    // Assert
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['total']).toBe(475);
    expect(body['offset']).toBe(0);
    expect(body['limit']).toBe(50);
    expect(Array.isArray(body['data'])).toBe(true);
  });

  it('uses defaults limit=100 offset=0 when no pagination params provided', async () => {
    // Act
    await get('/exercises');

    // Assert — listExercises called with pagination defaults
    const call = mockListExercises.mock.calls[0] as unknown as [
      string | undefined,
      Record<string, unknown>,
      { limit: number; offset: number },
    ];
    expect(call[2]).toEqual({ limit: 100, offset: 0 });
  });

  it('returns 400 VALIDATION_ERROR for limit=501', async () => {
    // Act
    const res = await get('/exercises?limit=501');

    // Assert — Elysia validates via t.Numeric({ maximum: 500 })
    expect(res.status).toBe(400);
  });

  it('returns 400 VALIDATION_ERROR for offset=-1', async () => {
    // Act
    const res = await get('/exercises?offset=-1');

    // Assert — Elysia validates via t.Numeric({ minimum: 0 })
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /exercises — filter cap behavior (REQ-SEC-002)
// ---------------------------------------------------------------------------

describe('GET /exercises — filter cap', () => {
  it('returns 200 with exactly 20 comma-separated values in a filter param', async () => {
    const values = Array.from({ length: 20 }, (_, i) => `val${i}`).join(',');
    const res = await get(`/exercises?level=${values}`);
    expect(res.status).toBe(200);
  });

  it('returns 200 with 21 comma-separated values (silently capped to 20)', async () => {
    // Implementation truncates to MAX_FILTER_VALUES=20 rather than rejecting
    const values = Array.from({ length: 21 }, (_, i) => `val${i}`).join(',');
    const res = await get(`/exercises?level=${values}`);
    expect(res.status).toBe(200);
  });

  it('returns 200 with q param containing a long plain string (not a CSV list)', async () => {
    // q is a plain search string, not comma-separated — cap does not apply
    const longQ = 'bench press overhead squat romanian deadlift lunge curl extension lat pulldown';
    const res = await get(`/exercises?q=${encodeURIComponent(longQ)}`);
    expect(res.status).toBe(200);
  });
});
