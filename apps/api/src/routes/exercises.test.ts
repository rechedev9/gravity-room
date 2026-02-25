/**
 * Exercise routes integration tests — auth guard + validation tests using Elysia's .handle().
 * GET /exercises and GET /muscle-groups are public (optional auth).
 * POST /exercises requires auth.
 */
process.env['JWT_SECRET'] = 'test-secret-must-be-at-least-32-chars-1234';
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): Promise<void> => Promise.resolve(),
}));

mock.module('../services/exercises', () => ({
  listExercises: mock(() => Promise.resolve([])),
  listMuscleGroups: mock(() => Promise.resolve([])),
  createExercise: mock(() => Promise.resolve({ ok: true, value: { id: 'test_exercise' } })),
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { exerciseRoutes } from './exercises';

// Wrap exerciseRoutes with the same error handler as the main app.
const testApp = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code };
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
// POST /exercises — slug validation
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
});
