/**
 * Result routes integration tests — auth guard tests using Elysia's .handle().
 * All routes require auth (nested under /programs/:id).
 */
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): Promise<void> => Promise.resolve(),
}));

mock.module('../services/results', () => ({
  recordResult: mock(() =>
    Promise.resolve({
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
      amrapReps: null,
      rpe: null,
    })
  ),
  deleteResult: mock(() => Promise.resolve()),
  undoLast: mock(() => Promise.resolve(null)),
}));

mock.module('../lib/program-cache', () => ({
  invalidateCachedInstance: mock(() => Promise.resolve()),
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { resultRoutes } from './results';

// Wrap resultRoutes with the same error handler as the main app.
const testApp = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code };
    }
    set.status = 401;
    return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
  })
  .use(resultRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

function del(path: string, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request(`http://localhost${path}`, {
      method: 'DELETE',
      headers,
    })
  );
}

// ---------------------------------------------------------------------------
// POST /programs/:id/results — auth required
// ---------------------------------------------------------------------------

describe('POST /programs/:id/results without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await post('/programs/inst-1/results', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /programs/:id/results/:workoutIndex/:slotId — auth required
// ---------------------------------------------------------------------------

describe('DELETE /programs/:id/results/:idx/:slot without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await del('/programs/inst-1/results/0/t1');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /programs/:id/undo — auth required
// ---------------------------------------------------------------------------

describe('POST /programs/:id/undo without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await post('/programs/inst-1/undo', {});
    expect(res.status).toBe(401);
  });
});
