/**
 * Result routes integration tests — auth guard tests using Elysia's .handle().
 * All routes require auth (nested under /programs/:id).
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

const { mockRateLimit, mockRecordResult, mockDeleteResult } = vi.hoisted(() => {
  const mockRateLimit = vi.fn((): Promise<void> => Promise.resolve());
  const mockRecordResult = vi.fn(() =>
    Promise.resolve({
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
      amrapReps: null,
      rpe: null,
    })
  );
  const mockDeleteResult = vi.fn(() => Promise.resolve());
  return {
    mockRateLimit,
    mockRecordResult,
    mockDeleteResult,
  };
});

vi.mock('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('../services/auth', () => ({
  findUserById: vi.fn((id: string) => Promise.resolve({ id })),
}));

vi.mock('../services/results', () => ({
  recordResult: mockRecordResult,
  deleteResult: mockDeleteResult,
  undoLast: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../lib/program-cache', () => ({
  invalidateCachedInstance: vi.fn(() => Promise.resolve()),
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { resultRoutes } from './results';

// Wrap resultRoutes with the same error handler as the main app.
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

async function makeValidJwt(userId: string): Promise<string> {
  const secret = process.env['JWT_SECRET'] ?? 'dev-secret-change-me';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iss: 'gravity-room-api',
      aud: 'gravity-room-clients',
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

const INSTANCE_ID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  mockRateLimit.mockClear();
  mockRecordResult.mockClear();
  mockDeleteResult.mockClear();
});

// ---------------------------------------------------------------------------
// POST /programs/:id/results — auth required
// ---------------------------------------------------------------------------

describe('POST /programs/:id/results without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await post(`/programs/${INSTANCE_ID}/results`, {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /programs/:id/results validation', () => {
  it('rejects workout indexes above the program definition cap before recording', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      `/programs/${INSTANCE_ID}/results`,
      {
        workoutIndex: 2000,
        slotId: 't1',
        result: 'success',
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockRecordResult).not.toHaveBeenCalled();
  });

  it('rejects AMRAP reps above the backend cap before rate limiting', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      `/programs/${INSTANCE_ID}/results`,
      {
        workoutIndex: 0,
        slotId: 't1',
        result: 'success',
        amrapReps: 100,
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockRecordResult).not.toHaveBeenCalled();
  });

  it('rejects implausibly large set-log weights before rate limiting', async () => {
    const token = await makeValidJwt('user-1');

    const res = await post(
      `/programs/${INSTANCE_ID}/results`,
      {
        workoutIndex: 0,
        slotId: 't1',
        result: 'success',
        setLogs: [{ reps: 5, weight: 10_001 }],
      },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockRecordResult).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DELETE /programs/:id/results/:workoutIndex/:slotId — auth required
// ---------------------------------------------------------------------------

describe('DELETE /programs/:id/results/:idx/:slot without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await del(`/programs/${INSTANCE_ID}/results/0/t1`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /programs/:id/results/:idx/:slot validation', () => {
  it('rejects workout indexes above the program definition cap before deleting', async () => {
    const token = await makeValidJwt('user-1');

    const res = await del(`/programs/${INSTANCE_ID}/results/2000/t1`, {
      Authorization: `Bearer ${token}`,
    });

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockDeleteResult).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /programs/:id/undo — auth required
// ---------------------------------------------------------------------------

describe('POST /programs/:id/undo without auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await post(`/programs/${INSTANCE_ID}/undo`, {});
    expect(res.status).toBe(401);
  });
});
