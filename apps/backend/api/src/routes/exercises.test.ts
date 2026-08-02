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

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

const { mockRateLimit, mockFindUserById, mockListExercises, mockCreateExercise } = vi.hoisted(
  () => {
    const mockRateLimit = vi.fn((): Promise<void> => Promise.resolve());
    const mockFindUserById = vi.fn(
      (id: string): Promise<{ id: string; authVersion: number } | undefined> =>
        Promise.resolve({ id, authVersion: 0 })
    );
    const mockListExercises = vi.fn<
      (
        userId?: string,
        filter?: Record<string, unknown>,
        pagination?: { limit: number; offset: number }
      ) => Promise<PaginatedResult>
    >(() => Promise.resolve({ data: [], total: 0, offset: 0, limit: 100 }));
    const mockCreateExercise = vi.fn(() =>
      Promise.resolve({ ok: true as const, value: { id: 'test_exercise' } })
    );
    return {
      mockRateLimit,
      mockFindUserById,
      mockListExercises,
      mockCreateExercise,
    };
  }
);

vi.mock('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('../services/auth', () => ({
  findUserById: mockFindUserById,
}));

interface PaginatedResult {
  readonly data: readonly Record<string, unknown>[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

vi.mock('../services/exercises', () => ({
  listExercises: mockListExercises,
  listMuscleGroups: vi.fn(() => Promise.resolve([])),
  createExercise: mockCreateExercise,
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

  it('returns 401 when optional auth token belongs to an inactive user', async () => {
    mockFindUserById.mockImplementation(() => Promise.resolve(undefined));
    const token = await makeValidJwt('deleted-user');

    const res = await get('/exercises', { Authorization: `Bearer ${token}` });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('TOKEN_USER_INACTIVE');
    expect(mockListExercises).not.toHaveBeenCalled();
  });

  it('returns 401 instead of silently downgrading an invalid Bearer token to anonymous', async () => {
    const res = await get('/exercises', { Authorization: 'Bearer not-a-valid-jwt' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('TOKEN_INVALID');
    expect(mockListExercises).not.toHaveBeenCalled();
  });

  it('accepts a valid token with lowercase bearer scheme casing', async () => {
    const token = await makeValidJwt('user-1');
    const res = await get('/exercises', { Authorization: `bearer ${token}` });

    expect(res.status).toBe(200);
    expect(mockListExercises).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('returns 401 for a malformed authorization scheme', async () => {
    const res = await get('/exercises', { Authorization: 'Basic credentials' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(mockListExercises).not.toHaveBeenCalled();
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

  it('returns 503 before creating a custom exercise when Redis fails', async () => {
    mockRateLimit.mockRejectedValueOnce(
      new ApiError(503, 'Rate limiter unavailable', 'RATE_LIMIT_UNAVAILABLE')
    );
    const token = await makeValidJwt('user-1');

    const res = await post(
      '/exercises',
      { name: 'Rate Limited Lift', muscleGroupId: 'chest' },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(503);
    expect(mockRateLimit).toHaveBeenCalledWith('user-1', 'POST /exercises', {
      failClosed: true,
    });
    expect(mockCreateExercise).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// JWT helper — build a valid HS256 token matching auth-guard's captured secret
// ---------------------------------------------------------------------------
//
// auth-guard.ts captures process.env['JWT_SECRET'] at import time (module evaluation).
// We read the same env var at CALL time (test body execution), which is AFTER all
// modules load but BEFORE any static test-body override of JWT_SECRET.
// Fallback: 'test-secret-do-not-use-outside-tests' matches auth-guard's TEST_SECRET
// constant (the NODE_ENV=test fallback), so the token verifies when JWT_SECRET is unset.
// ---------------------------------------------------------------------------

async function makeValidJwt(userId: string): Promise<string> {
  // Must read at call time — same env state auth-guard captured at import time.
  const secret = process.env['JWT_SECRET'] ?? 'test-secret-do-not-use-outside-tests';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iss: 'gravity-room-api',
      aud: 'gravity-room-clients',
      av: 0,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
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
  it('returns 401 for a Unicode name when auth is missing', async () => {
    const res = await post('/exercises', {
      name: '\u00e7\u00e9\u00e0\u00fc',
      muscleGroupId: 'chest',
    });
    // 401 because auth guard runs before the slug check
    expect(res.status).toBe(401);
  });

  it('accepts a name made entirely of accented Latin characters', async () => {
    const token = await makeValidJwt('user-1');
    const res = await post(
      '/exercises',
      { name: '\u00e7\u00e9\u00e0\u00fc', muscleGroupId: 'chest' },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    expect(res.status).toBe(201);
    expect(mockCreateExercise).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'ceau' })
    );
  });

  it('folds accents instead of dropping accented letters from a mixed name', async () => {
    const token = await makeValidJwt('user-1');
    const res = await post(
      '/exercises',
      { name: 'abc\u00e9', muscleGroupId: 'chest' },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    expect(res.status).toBe(201);
    expect(mockCreateExercise).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'abce' })
    );
  });

  it('preserves letters from scripts without an ASCII transliteration', async () => {
    const token = await makeValidJwt('user-1');
    const res = await post(
      '/exercises',
      { name: '深蹲', muscleGroupId: 'legs' },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    expect(res.status).toBe(201);
    expect(mockCreateExercise).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: '深蹲' })
    );
  });

  it('preserves meaningful combining marks in non-Latin scripts', async () => {
    const token = await makeValidJwt('user-1');
    const res = await post(
      '/exercises',
      { name: 'किताब', muscleGroupId: 'arms' },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    expect(res.status).toBe(201);
    expect(mockCreateExercise).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'किताब' })
    );
  });

  it('still rejects names that contain no letters or numbers', async () => {
    const token = await makeValidJwt('user-1');
    const res = await post(
      '/exercises',
      { name: '---', muscleGroupId: 'chest' },
      {
        Authorization: `Bearer ${token}`,
      }
    );

    expect(res.status).toBe(422);
    const body: unknown = await res.json();
    expect((body as Record<string, unknown>)['code']).toBe('INVALID_SLUG');
  });
});

// ---------------------------------------------------------------------------
// GET /exercises — filter cap behavior (REQ-SEC-002)
// ---------------------------------------------------------------------------

describe('GET /exercises — filter query validation', () => {
  it('rejects oversized comma-separated filters before rate limiting or listing', async () => {
    const res = await get(`/exercises?equipment=${'a'.repeat(2050)}`);

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockListExercises).not.toHaveBeenCalled();
  });

  it('rejects oversized boolean filters before rate limiting or listing', async () => {
    const res = await get(`/exercises?isCompound=${'true'.repeat(32)}`);

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockListExercises).not.toHaveBeenCalled();
  });

  it.each(['TRUE', '1', 'yes', ''])(
    'rejects unsupported boolean filter value %j instead of dropping it',
    async (value) => {
      const res = await get(`/exercises?isCompound=${encodeURIComponent(value)}`);

      expect(res.status).toBe(400);
      expect(mockListExercises).not.toHaveBeenCalled();
    }
  );
});

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRateLimit.mockReset();
  mockRateLimit.mockImplementation(() => Promise.resolve());
  mockFindUserById.mockClear();
  mockFindUserById.mockImplementation((id: string) => Promise.resolve({ id, authVersion: 0 }));
  mockListExercises.mockClear();
  mockCreateExercise.mockClear();
  mockCreateExercise.mockImplementation(() =>
    Promise.resolve({ ok: true as const, value: { id: 'test_exercise' } })
  );
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
    });

    // Assert — first arg to rateLimit is the key (uses ip from context, not x-forwarded-for)
    const call = mockRateLimit.mock.calls[0] as unknown as [string, string, ...unknown[]];
    expect(call[0]).toBe('user-1:unknown');
  });

  it('unauthenticated request uses IP-only key', async () => {
    // Act
    await get('/exercises');

    // Assert
    const call = mockRateLimit.mock.calls[0] as unknown as [string, string, ...unknown[]];
    expect(call[0]).toBe('unknown');
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
    expect(mockListExercises.mock.calls[0]?.[2]).toEqual({ limit: 50, offset: 0 });
  });

  it('uses defaults limit=100 offset=0 when no pagination params provided', async () => {
    // Act
    await get('/exercises');

    // Assert — listExercises called with pagination defaults
    expect(mockListExercises.mock.calls[0]?.[2]).toEqual({ limit: 100, offset: 0 });
  });

  it('returns 400 VALIDATION_ERROR for limit=1001', async () => {
    // Act
    const res = await get('/exercises?limit=1001');

    // Assert — Elysia validates via t.Numeric({ maximum: 1000 })
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

  it('returns 400 with 21 comma-separated values instead of silently truncating', async () => {
    const values = Array.from({ length: 21 }, (_, i) => `val${i}`).join(',');
    const res = await get(`/exercises?level=${values}`);
    expect(res.status).toBe(400);
    expect(mockListExercises).not.toHaveBeenCalled();
  });

  it('returns 400 with q longer than the bounded public search length', async () => {
    const longQ = 'x'.repeat(101);
    const res = await get(`/exercises?q=${encodeURIComponent(longQ)}`);
    expect(res.status).toBe(400);
    expect(mockListExercises).not.toHaveBeenCalled();
  });

  it('returns 400 when offset exceeds the bounded public pagination window', async () => {
    const res = await get('/exercises?offset=10001');
    expect(res.status).toBe(400);
    expect(mockListExercises).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /exercises — JWT algorithm pinning (defense against alg-confusion)
// ---------------------------------------------------------------------------
//
// These go through the real @elysiajs/jwt verifier (jose under the hood). The
// optional-auth path must reject a token whose header advertises an algorithm
// other than HS256 (an `alg: none` unsecured token or an asymmetric RS256 token)
// instead of trusting the unverified claims inside it.

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const downgradeClaims = {
  sub: 'user-1',
  iss: 'gravity-room-api',
  aud: 'gravity-room-clients',
  av: 0,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

/** An unsecured (`alg: none`) JWT with an empty signature segment. */
function makeNoneAlgJwt(): string {
  const header = base64urlJson({ alg: 'none', typ: 'JWT' });
  const payload = base64urlJson(downgradeClaims);
  return `${header}.${payload}.`;
}

/** A well-formed RS256 token signed with a freshly generated RSA private key. */
async function makeRs256Jwt(): Promise<string> {
  const header = base64urlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64urlJson(downgradeClaims);
  const signingInput = `${header}.${payload}`;
  const { privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${Buffer.from(sig).toString('base64url')}`;
}

describe('GET /exercises — JWT algorithm pinning', () => {
  it('rejects an alg:none (unsecured) token instead of downgrading it to anonymous', async () => {
    const res = await get('/exercises', { Authorization: `Bearer ${makeNoneAlgJwt()}` });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('TOKEN_INVALID');
    expect(mockListExercises).not.toHaveBeenCalled();
  });

  it('rejects an RS256 (asymmetric) token signed with an attacker key', async () => {
    const token = await makeRs256Jwt();
    const res = await get('/exercises', { Authorization: `Bearer ${token}` });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('TOKEN_INVALID');
    expect(mockListExercises).not.toHaveBeenCalled();
  });
});
