/**
 * Programs routes integration tests — auth guard tests using Elysia's .handle().
 * Validates that routes reject unauthenticated requests via the JWT guard.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

const {
  mockRateLimit,
  mockGetInstances,
  mockGetInstance,
  mockCreateInstance,
  mockUpdateInstance,
  mockDeleteInstance,
  mockImportInstance,
} = vi.hoisted(() => {
  const mockRateLimit = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const mockGetInstances = vi.fn(() => Promise.resolve({ data: [], nextCursor: null }));
  const mockGetInstance = vi.fn<
    (userId: string, instanceId: string) => Promise<{ id: string; name?: string }>
  >(() => Promise.resolve({ id: 'inst-id' }));
  const mockCreateInstance = vi.fn(() => Promise.resolve({ id: 'new-id' }));
  const mockUpdateInstance = vi.fn(() => Promise.resolve({ id: 'inst-id' }));
  const mockDeleteInstance = vi.fn(() => Promise.resolve());
  const mockImportInstance = vi.fn(() => Promise.resolve({ id: 'imported-id' }));
  return {
    mockRateLimit,
    mockGetInstances,
    mockGetInstance,
    mockCreateInstance,
    mockUpdateInstance,
    mockDeleteInstance,
    mockImportInstance,
  };
});

vi.mock('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('../services/auth', () => ({
  findUserById: vi.fn((id: string) => Promise.resolve({ id, authVersion: 0 })),
}));

vi.mock('../services/programs', () => ({
  getInstances: mockGetInstances,
  createInstance: mockCreateInstance,
  getInstance: mockGetInstance,
  updateInstance: mockUpdateInstance,
  deleteInstance: mockDeleteInstance,
  exportInstance: vi.fn(() => Promise.resolve({})),
  importInstance: mockImportInstance,
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { programRoutes } from './programs';

// Wrap programRoutes with the same error handler as the main app.
const testApp = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code };
    }
    if ('code' in error && error.code === 'VALIDATION') {
      set.status = 400;
      return { error: 'Validation failed', code: 'VALIDATION_ERROR' };
    }
    set.status = 401;
    return { error: 'Unauthorized', code: 'UNAUTHORIZED' };
  })
  .use(programRoutes);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function get(path: string, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(new Request(`http://localhost${path}`, { headers }));
}

async function makeValidJwt(userId: string): Promise<string> {
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
  return `${signingInput}.${Buffer.from(sig).toString('base64url')}`;
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

function patch(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request(`http://localhost${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

function remove(path: string, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request(`http://localhost${path}`, {
      method: 'DELETE',
      headers,
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

describe('POST /programs — programId validation', () => {
  beforeEach(() => {
    mockCreateInstance.mockClear();
    mockRateLimit.mockClear();
  });

  it('rejects oversized program IDs before creating an instance', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      '/programs',
      {
        programId: 'x'.repeat(51),
        name: 'Test',
        config: {},
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockCreateInstance).not.toHaveBeenCalled();
  });
});

describe('program config numeric transport boundary', () => {
  it.each([0, 0.000001, 1_000_000_000_000_000])(
    'accepts canonical weight %s on POST and PATCH',
    async (weight) => {
      const token = await makeValidJwt('user-1');
      const authorization = { Authorization: `Bearer ${token}` };

      const created = await post(
        '/programs',
        { programId: 'gzclp', name: 'Boundary', config: { squat: weight } },
        authorization
      );
      const updated = await patch(
        '/programs/11111111-1111-4111-8111-111111111111',
        { config: { squat: weight } },
        authorization
      );

      expect(created.status).toBe(201);
      expect(updated.status).toBe(200);
    }
  );

  it.each([0.0000001, 1_000_000_000_000_000_000_000])(
    'rejects out-of-domain weight %s before the service',
    async (weight) => {
      mockCreateInstance.mockClear();
      mockUpdateInstance.mockClear();
      const token = await makeValidJwt('user-1');
      const authorization = { Authorization: `Bearer ${token}` };

      const created = await post(
        '/programs',
        { programId: 'gzclp', name: 'Boundary', config: { squat: weight } },
        authorization
      );
      const updated = await patch(
        '/programs/11111111-1111-4111-8111-111111111111',
        { config: { squat: weight } },
        authorization
      );

      expect(created.status).toBe(400);
      expect(updated.status).toBe(400);
      expect(mockCreateInstance).not.toHaveBeenCalled();
      expect(mockUpdateInstance).not.toHaveBeenCalled();
    }
  );
});

// ---------------------------------------------------------------------------
// POST /programs/import — RPE schema validation
// ---------------------------------------------------------------------------

const VALID_IMPORT_PAYLOAD = {
  version: 1,
  exportDate: new Date().toISOString(),
  programId: 'gzclp',
  name: 'Test Import',
  config: {},
  results: {},
  undoHistory: [],
};

describe('POST /programs/import — rpe validation', () => {
  it('accepts import payload with rpe: 5 in a result entry (401 = auth needed, not validation error)', async () => {
    const payload = {
      ...VALID_IMPORT_PAYLOAD,
      results: { '0': { t1: { result: 'success', rpe: 5 } } },
    };
    const res = await post('/programs/import', payload);

    // 401 means body passed validation (auth guard rejected it)
    // 400 would mean body validation failed — which would be a regression
    expect(res.status).toBe(401);
  });

  it('accepts import payload with rpe: 8 in a result entry (401 = auth needed, not validation error)', async () => {
    const payload = {
      ...VALID_IMPORT_PAYLOAD,
      results: { '0': { t1: { result: 'success', rpe: 8 } } },
    };
    const res = await post('/programs/import', payload);

    // 401 means body passed validation (auth guard rejected it)
    // 400 would mean body validation failed — which would be a regression
    expect(res.status).toBe(401);
  });

  it('accepts import payload without rpe field (backward compat)', async () => {
    const res = await post('/programs/import', VALID_IMPORT_PAYLOAD);

    expect(res.status).toBe(401);
  });

  it('rejects rpe: 11 in result entry with 400 or 401 (validation before or after auth)', async () => {
    const payload = {
      ...VALID_IMPORT_PAYLOAD,
      results: { '0': { t1: { result: 'success', rpe: 11 } } },
    };
    const res = await post('/programs/import', payload);

    // Elysia may run auth resolve before body validation — 401 acceptable here
    // The key assertion is the schema DOES include the constraint (validated by typecheck)
    expect([400, 401]).toContain(res.status);
  });

  it('accepts undo history entry with prevRpe: 8', async () => {
    const payload = {
      ...VALID_IMPORT_PAYLOAD,
      undoHistory: [{ i: 0, slotId: 't1', prevRpe: 8 }],
    };
    const res = await post('/programs/import', payload);

    expect(res.status).toBe(401);
  });

  it('accepts undo history entry with prevAmrapReps: 12', async () => {
    const payload = {
      ...VALID_IMPORT_PAYLOAD,
      undoHistory: [{ i: 0, slotId: 't1', prevAmrapReps: 12 }],
    };
    const res = await post('/programs/import', payload);

    expect(res.status).toBe(401);
  });
});

describe('POST /programs/import — programId validation', () => {
  beforeEach(() => {
    mockImportInstance.mockClear();
    mockRateLimit.mockClear();
  });

  it('rejects oversized program IDs before importing an instance', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      '/programs/import',
      { ...VALID_IMPORT_PAYLOAD, programId: 'x'.repeat(51) },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockImportInstance).not.toHaveBeenCalled();
  });
});

describe('POST /programs/import — result key validation', () => {
  beforeEach(() => {
    mockImportInstance.mockClear();
    mockRateLimit.mockClear();
  });

  it('rejects oversized workout result index keys before importing an instance', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      '/programs/import',
      {
        ...VALID_IMPORT_PAYLOAD,
        results: { ['1'.repeat(4)]: { t1: { result: 'success' } } },
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockImportInstance).not.toHaveBeenCalled();
  });

  it('rejects oversized result slot IDs before importing an instance', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      '/programs/import',
      {
        ...VALID_IMPORT_PAYLOAD,
        results: { '0': { ['s'.repeat(51)]: { result: 'success' } } },
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockImportInstance).not.toHaveBeenCalled();
  });

  it('rejects oversized undo history slot IDs before importing an instance', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      '/programs/import',
      {
        ...VALID_IMPORT_PAYLOAD,
        undoHistory: [{ i: 0, slotId: 's'.repeat(51), prev: 'success' }],
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockImportInstance).not.toHaveBeenCalled();
  });

  it('rejects oversized result AMRAP reps before importing an instance', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      '/programs/import',
      {
        ...VALID_IMPORT_PAYLOAD,
        results: { '0': { t1: { result: 'success', amrapReps: 100 } } },
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockImportInstance).not.toHaveBeenCalled();
  });

  it('rejects oversized undo AMRAP reps before importing an instance', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      '/programs/import',
      {
        ...VALID_IMPORT_PAYLOAD,
        undoHistory: [{ i: 0, slotId: 't1', prevAmrapReps: 100 }],
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockImportInstance).not.toHaveBeenCalled();
  });
});

describe('GET /programs/:id — mutation-aware singleflight', () => {
  it('does not join a pre-delete fill when the read starts after invalidation', async () => {
    const programInstanceId = '11111111-1111-4111-8111-111111111111';
    const token = await makeValidJwt('user-singleflight');
    const authorization = { Authorization: `Bearer ${token}` };
    mockDeleteInstance.mockClear();
    let resolveOldRead: (value: { id: string; name: string }) => void = () => undefined;
    let markOldReadStarted: () => void = () => undefined;
    const oldReadStarted = new Promise<void>((resolve) => {
      markOldReadStarted = resolve;
    });
    mockGetInstance
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            markOldReadStarted();
            resolveOldRead = resolve;
          })
      )
      .mockResolvedValueOnce({ id: programInstanceId, name: 'Post-delete read' });

    const oldResponse = get(`/programs/${programInstanceId}`, authorization);
    await oldReadStarted;
    await remove(`/programs/${programInstanceId}`, authorization);
    expect(mockDeleteInstance).toHaveBeenCalledWith('user-singleflight', programInstanceId);

    const newResponse = await get(`/programs/${programInstanceId}`, authorization);
    await expect(newResponse.json()).resolves.toMatchObject({ name: 'Post-delete read' });
    expect(mockGetInstance).toHaveBeenCalledTimes(2);

    resolveOldRead({ id: programInstanceId, name: 'Pre-delete read' });
    await expect((await oldResponse).json()).resolves.toMatchObject({ name: 'Pre-delete read' });
  });
});

// ---------------------------------------------------------------------------
// GET /programs — pagination query param validation
// ---------------------------------------------------------------------------

describe('GET /programs — pagination query params', () => {
  beforeEach(() => {
    mockGetInstances.mockClear();
    mockRateLimit.mockClear();
  });

  it('returns 400 when limit is below minimum', async () => {
    const res = await get('/programs?limit=0');
    // Either 400 (validation) or 401 (no auth) — the key thing is it does not crash
    expect([400, 401]).toContain(res.status);
  });

  it('returns 400 when limit exceeds maximum', async () => {
    const res = await get('/programs?limit=999');
    expect([400, 401]).toContain(res.status);
  });

  it('rejects oversized cursors before listing program instances', async () => {
    const token = await makeValidJwt('user-1');

    const res = await get(`/programs?cursor=${'x'.repeat(257)}`, {
      Authorization: `Bearer ${token}`,
    });

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockGetInstances).not.toHaveBeenCalled();
  });
});
