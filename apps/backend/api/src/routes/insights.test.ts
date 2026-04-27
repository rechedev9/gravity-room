// Auth: auth-guard captures JWT_SECRET at import time, so the token helper below
// reads it at call time. Do NOT assign process.env['JWT_SECRET'] at module top level —
// that would override the value AFTER auth-guard already captured it.
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): Promise<void> => Promise.resolve(),
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
    set.status = 500;
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  .use(insightsRoutes);

// ---------------------------------------------------------------------------
// JWT helper
// ---------------------------------------------------------------------------

async function makeValidJwt(userId: string): Promise<string> {
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
