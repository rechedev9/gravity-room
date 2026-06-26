// Auth: auth-guard captures JWT_SECRET at import time, so the token helper below
// reads it at call time. Do NOT assign process.env['JWT_SECRET'] at module top level —
// that would override the value AFTER auth-guard already captured it.
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect, beforeEach, afterAll } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

// bun's mock.module writes to a process-global registry, so these mocks would
// otherwise leak into other test files run in the same invocation (and
// mock.restore() does NOT undo module mocks). Capture the real modules first, then
// re-install them in afterAll so these mocks are fully scoped to this file. Without
// this, the mocked services/auth (findUserById stub) leaks and 401s the sibling
// exercises.test.ts + services/insights.test.ts when the suite runs together.
const realRateLimit = { ...(await import('../middleware/rate-limit')) };
const realAuth = { ...(await import('../services/auth')) };
const realInsightsService = { ...(await import('../services/insights')) };

const mockRateLimit = mock<() => Promise<void>>(() => Promise.resolve());

mock.module('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

mock.module('../services/auth', () => ({
  findUserById: mock((id: string) => Promise.resolve({ id })),
}));

interface InsightRow {
  readonly insightType: string;
  readonly exerciseId: string | null;
  readonly payload: unknown;
  readonly computedAt: Date;
  readonly validUntil: Date | null;
}

const mockGetInsights = mock<(userId: string, types: readonly string[]) => Promise<InsightRow[]>>(
  () => Promise.resolve([])
);

mock.module('../services/insights', () => ({
  getInsights: mockGetInsights,
}));

afterAll(() => {
  mock.module('../middleware/rate-limit', () => realRateLimit);
  mock.module('../services/auth', () => realAuth);
  mock.module('../services/insights', () => realInsightsService);
});

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { insightsRoutes } from './insights';
import { INSIGHT_TYPES } from '../lib/insight-types';

const testApp = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code, ...(error.details ?? {}) };
    }
    if ('code' in error && error.code === 'VALIDATION') {
      set.status = 400;
      return { error: 'Validation failed', code: 'VALIDATION_ERROR' };
    }
    set.status = 500;
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  .use(insightsRoutes);

// ---------------------------------------------------------------------------
// JWT helper
// ---------------------------------------------------------------------------

async function makeValidJwt(userId: string): Promise<string> {
  // Fallback matches auth-guard's TEST_SECRET (the NODE_ENV=test fallback) so the
  // token verifies when JWT_SECRET is unset, e.g. under `bun test src/routes`.
  const secret = process.env['JWT_SECRET'] ?? 'test-secret-do-not-use-outside-tests';
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
  const signature = Buffer.from(sig).toString('base64url');
  return `${signingInput}.${signature}`;
}

function get(path: string, headers: Record<string, string>): Promise<Response> {
  return testApp.handle(new Request(`http://localhost${path}`, { headers }));
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const USER_ID = '00000000-0000-0000-0000-000000000001';
const FROZEN = new Date('2026-04-17T12:00:00Z');

const FREQUENCY_ROW: InsightRow = {
  insightType: 'frequency',
  exerciseId: null,
  payload: { count: 3 },
  computedAt: FROZEN,
  validUntil: null,
};

const VOLUME_TREND_ROW: InsightRow = {
  insightType: 'volume_trend',
  exerciseId: 'squat',
  payload: { trend: 'up' },
  computedAt: FROZEN,
  validUntil: null,
};

// ---------------------------------------------------------------------------
// Scenario coverage
// ---------------------------------------------------------------------------

describe('GET /insights — types query validation', () => {
  beforeEach(() => {
    mockGetInsights.mockReset();
    mockRateLimit.mockClear();
  });

  it('returns 200 and filtered rows when all types are known', async () => {
    mockGetInsights.mockImplementation(() => Promise.resolve([VOLUME_TREND_ROW, FREQUENCY_ROW]));
    const token = await makeValidJwt(USER_ID);
    const res = await get('/insights?types=volume_trend,frequency', {
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(mockGetInsights).toHaveBeenCalledTimes(1);
    const call = mockGetInsights.mock.calls[0];
    expect(call?.[1]).toEqual(['volume_trend', 'frequency']);
  });

  it('returns 200 and all rows when types param is omitted', async () => {
    mockGetInsights.mockImplementation(() => Promise.resolve([FREQUENCY_ROW, VOLUME_TREND_ROW]));
    const token = await makeValidJwt(USER_ID);
    const res = await get('/insights', { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(mockGetInsights).toHaveBeenCalledTimes(1);
    const call = mockGetInsights.mock.calls[0];
    expect(call?.[1]).toEqual([]);
  });

  it('treats types= (empty value) as omitted', async () => {
    mockGetInsights.mockImplementation(() => Promise.resolve([]));
    const token = await makeValidJwt(USER_ID);
    const res = await get('/insights?types=', { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const call = mockGetInsights.mock.calls[0];
    expect(call?.[1]).toEqual([]);
  });

  it('returns 400 with structured body for a single unknown type', async () => {
    const token = await makeValidJwt(USER_ID);
    const res = await get('/insights?types=bogus', { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      code: string;
      invalidValues: string[];
      validValues: string[];
    };
    expect(body.code).toBe('INVALID_INSIGHT_TYPE');
    expect(body.invalidValues).toEqual(['bogus']);
    expect(body.validValues).toEqual([...INSIGHT_TYPES]);
    expect(mockRateLimit).toHaveBeenCalledWith(USER_ID, 'GET /insights', { maxRequests: 30 });
    expect(mockGetInsights).not.toHaveBeenCalled();
  });

  it('rejects oversized types queries before parsing and echoing invalid values', async () => {
    const token = await makeValidJwt(USER_ID);
    const res = await get(`/insights?types=${'x'.repeat(513)}`, {
      Authorization: `Bearer ${token}`,
    });
    const body = (await res.json()) as { code: string; invalidValues?: string[] };

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.invalidValues).toBeUndefined();
    expect(mockGetInsights).not.toHaveBeenCalled();
  });

  it('returns 400 when a valid type is mixed with an unknown type', async () => {
    const token = await makeValidJwt(USER_ID);
    const res = await get('/insights?types=frequency,bogus', {
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; invalidValues: string[] };
    expect(body.code).toBe('INVALID_INSIGHT_TYPE');
    expect(body.invalidValues).toEqual(['bogus']);
    expect(mockGetInsights).not.toHaveBeenCalled();
  });

  it('accepts whitespace around known type names', async () => {
    mockGetInsights.mockImplementation(() => Promise.resolve([FREQUENCY_ROW]));
    const token = await makeValidJwt(USER_ID);
    const res = await get('/insights?types=%20frequency%20', {
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    const call = mockGetInsights.mock.calls[0];
    expect(call?.[1]).toEqual(['frequency']);
  });
});
