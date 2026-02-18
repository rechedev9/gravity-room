/**
 * Programs routes integration tests — auth guard tests using Elysia's .handle().
 * Validates that routes reject unauthenticated requests via the JWT guard.
 */
process.env['JWT_SECRET'] = 'test-secret-must-be-at-least-32-chars-1234';
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): void => {
    /* no-op */
  },
}));

mock.module('../services/programs', () => ({
  getInstances: mock(() => Promise.resolve([])),
  createInstance: mock(() => Promise.resolve({ id: 'new-id' })),
  getInstance: mock(() => Promise.resolve({ id: 'inst-id' })),
  updateInstance: mock(() => Promise.resolve({ id: 'inst-id' })),
  deleteInstance: mock(() => Promise.resolve()),
  exportInstance: mock(() => Promise.resolve({})),
  importInstance: mock(() => Promise.resolve({ id: 'imported-id' })),
}));

import { programRoutes } from './programs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function get(path: string, headers?: Record<string, string>): Promise<Response> {
  return programRoutes.handle(new Request(`http://localhost${path}`, { headers }));
}

function post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return programRoutes.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

// ---------------------------------------------------------------------------
// Auth guard tests
// ---------------------------------------------------------------------------

describe('GET /programs without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await get('/programs');
    expect(res.status).toBe(401);
  });

  it('returns 401 when an invalid token is provided', async () => {
    const res = await get('/programs', { Authorization: 'Bearer not-a-real-jwt' });
    expect(res.status).toBe(401);
  });
});

describe('POST /programs without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await post('/programs', {
      programId: 'gzclp',
      name: 'Test',
      config: {},
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when an invalid token is provided', async () => {
    const res = await post(
      '/programs',
      { programId: 'gzclp', name: 'Test', config: {} },
      { Authorization: 'Bearer not-a-real-jwt' }
    );
    expect(res.status).toBe(401);
  });
});
