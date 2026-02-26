/**
 * Program definition routes integration tests — auth guard tests using Elysia's .handle().
 * All routes require auth.
 */
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): Promise<void> => Promise.resolve(),
}));

mock.module('../services/program-definitions', () => ({
  create: mock(() => Promise.resolve({ id: 'pd-1' })),
  list: mock(() => Promise.resolve({ data: [], total: 0 })),
  getById: mock(() => Promise.resolve(null)),
  update: mock(() => Promise.resolve({ id: 'pd-1' })),
  softDelete: mock(() => Promise.resolve(true)),
  updateStatus: mock(() => Promise.resolve({ id: 'pd-1', status: 'pending_review' })),
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { programDefinitionRoutes } from './program-definitions';

// Wrap programDefinitionRoutes with the same error handler as the main app.
const testApp = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code };
    }
    set.status = 401;
    return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
  })
  .use(programDefinitionRoutes);

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

function del(path: string, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request(`http://localhost${path}`, {
      method: 'DELETE',
      headers,
    })
  );
}

// ---------------------------------------------------------------------------
// POST /program-definitions — auth required
// ---------------------------------------------------------------------------

describe('POST /program-definitions without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await post('/program-definitions', { definition: {} });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /program-definitions — auth required
// ---------------------------------------------------------------------------

describe('GET /program-definitions without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await get('/program-definitions');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /program-definitions/:id — auth required
// ---------------------------------------------------------------------------

describe('GET /program-definitions/:id without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await get('/program-definitions/pd-1');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /program-definitions/:id — auth required
// ---------------------------------------------------------------------------

describe('DELETE /program-definitions/:id without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await del('/program-definitions/pd-1');
    expect(res.status).toBe(401);
  });
});
