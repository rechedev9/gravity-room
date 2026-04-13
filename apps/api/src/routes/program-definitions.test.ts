/**
 * Program definition routes integration tests — auth guard tests using Elysia's .handle().
 * All routes require auth.
 */
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): Promise<void> => Promise.resolve(),
}));

type SoftDeleteResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false; readonly error: string };

const mockSoftDelete = mock<() => Promise<SoftDeleteResult>>(() =>
  Promise.resolve({ ok: true, value: true })
);

mock.module('../services/program-definitions', () => ({
  create: mock(() => Promise.resolve({ id: 'pd-1' })),
  list: mock(() => Promise.resolve({ data: [], total: 0 })),
  getById: mock(() => Promise.resolve(null)),
  update: mock(() => Promise.resolve({ id: 'pd-1' })),
  softDelete: mockSoftDelete,
  updateStatus: mock(() => Promise.resolve({ id: 'pd-1', status: 'pending_review' })),
  forkDefinition: mock(() => Promise.resolve({ ok: true, value: { id: 'pd-fork' } })),
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
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSoftDelete.mockClear();
  mockSoftDelete.mockImplementation(() => Promise.resolve({ ok: true, value: true }));
});

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
// DELETE /program-definitions/:id — auth required (REQ-DGUARD-002, REQ-DGUARD-004, REQ-DGUARD-005)
// ---------------------------------------------------------------------------

describe('DELETE /program-definitions/:id without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await del('/program-definitions/pd-1');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /program-definitions/:id — deletion guard (REQ-DGUARD-002)', () => {
  // NOTE: Route-level tests here verify auth enforcement only. The jwtPlugin
  // requires a real JWT, so unauthenticated requests always return 401.
  // The actual Result<boolean, DeleteError> mapping logic is tested at the
  // service level (program-definitions.test.ts) and in the route handler
  // source (program-definitions.ts lines 207-218).

  it('returns 401 for unauthenticated DELETE (auth guard fires before softDelete)', async () => {
    const res = await del('/program-definitions/pd-1');

    expect(res.status).toBe(401);
    // softDelete should NOT have been called because auth rejected first
    expect(mockSoftDelete).not.toHaveBeenCalled();
  });

  it('returns 401 even with ?force=true query param (REQ-DGUARD-004)', async () => {
    const res = await del('/program-definitions/pd-1?force=true');

    expect(res.status).toBe(401);
  });
});
