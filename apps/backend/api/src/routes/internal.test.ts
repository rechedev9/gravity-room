/**
 * Tests for the secret-guarded internal cron routes.
 *
 * The data-access + service layer is mocked via mock.module so no DB is touched.
 * These modules are not consumed by sibling route tests in the same `bun test
 * src/routes` invocation (services/auth is only mocked by auth.test, which runs
 * earlier; resolveUserId never imports it), so the process-global mock registry
 * does not leak into them.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before importing the route module
// ---------------------------------------------------------------------------

const {
  mockCleanupExpiredTokens,
  mockPurgeDeletedUsers,
  mockComputeUser,
  mockFetchLeastRecentlyComputedUsers,
} = vi.hoisted(() => {
  const mockCleanupExpiredTokens = vi.fn<() => Promise<number>>(() => Promise.resolve(0));
  const mockPurgeDeletedUsers = vi.fn<() => Promise<PurgeSummary>>(() =>
    Promise.resolve({ purged: 0, cutoff: '1970-01-01T00:00:00.000Z' })
  );
  const mockComputeUser = vi.fn<(userId: string) => Promise<void>>(() => Promise.resolve());
  const mockFetchLeastRecentlyComputedUsers = vi.fn<
    (limit: number) => Promise<{ userId: string }[]>
  >(() => Promise.resolve([]));
  return {
    mockCleanupExpiredTokens,
    mockPurgeDeletedUsers,
    mockComputeUser,
    mockFetchLeastRecentlyComputedUsers,
  };
});
vi.mock('../services/auth', () => ({
  cleanupExpiredTokens: mockCleanupExpiredTokens,
}));

interface PurgeSummary {
  readonly purged: number;
  readonly cutoff: string;
}
vi.mock('../services/purge', () => ({
  purgeDeletedUsers: mockPurgeDeletedUsers,
}));

vi.mock('../analytics/compute', () => ({
  computeUser: mockComputeUser,
}));

vi.mock('../analytics/queries', () => ({
  fetchLeastRecentlyComputedUsers: mockFetchLeastRecentlyComputedUsers,
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { internalRoutes } from './internal';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const SECRET = 'super-secret-cron-token';

const testApp = new Elysia()
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return { error: error.message, code: error.code, ...(error.details ?? {}) };
    }
    set.status = 500;
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  .use(internalRoutes);

function post(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return testApp.handle(new Request(`http://localhost${path}`, { method: 'POST', headers }));
}

function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return testApp.handle(new Request(`http://localhost${path}`, { method: 'GET', headers }));
}

const ORIGINAL_SECRET = process.env['INTERNAL_SECRET'];
const ORIGINAL_CRON_SECRET = process.env['CRON_SECRET'];
const ORIGINAL_BATCH = process.env['ANALYTICS_BATCH_SIZE'];

beforeEach(() => {
  process.env['INTERNAL_SECRET'] = SECRET;
  delete process.env['CRON_SECRET'];
  delete process.env['ANALYTICS_BATCH_SIZE'];
  mockCleanupExpiredTokens.mockReset();
  mockCleanupExpiredTokens.mockImplementation(() => Promise.resolve(0));
  mockPurgeDeletedUsers.mockReset();
  mockPurgeDeletedUsers.mockImplementation(() =>
    Promise.resolve({ purged: 0, cutoff: '1970-01-01T00:00:00.000Z' })
  );
  mockComputeUser.mockReset();
  mockComputeUser.mockImplementation(() => Promise.resolve());
  mockFetchLeastRecentlyComputedUsers.mockReset();
  mockFetchLeastRecentlyComputedUsers.mockImplementation(() => Promise.resolve([]));
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env['INTERNAL_SECRET'];
  else process.env['INTERNAL_SECRET'] = ORIGINAL_SECRET;
  if (ORIGINAL_CRON_SECRET === undefined) delete process.env['CRON_SECRET'];
  else process.env['CRON_SECRET'] = ORIGINAL_CRON_SECRET;
  if (ORIGINAL_BATCH === undefined) delete process.env['ANALYTICS_BATCH_SIZE'];
  else process.env['ANALYTICS_BATCH_SIZE'] = ORIGINAL_BATCH;
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe('internal routes — secret guard', () => {
  const guarded = [
    '/internal/cleanup-tokens',
    '/internal/purge-users',
    '/internal/analytics/compute',
  ];

  for (const path of guarded) {
    it(`returns 401 for ${path} with no secret header`, async () => {
      const res = await post(path);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('UNAUTHORIZED');
      expect(mockCleanupExpiredTokens).not.toHaveBeenCalled();
      expect(mockPurgeDeletedUsers).not.toHaveBeenCalled();
      expect(mockComputeUser).not.toHaveBeenCalled();
    });

    it(`returns 401 for ${path} with a wrong secret`, async () => {
      const res = await post(path, { Authorization: 'Bearer wrong-secret' });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('UNAUTHORIZED');
    });
  }

  it('returns 401 when neither INTERNAL_SECRET nor CRON_SECRET is configured (fail closed)', async () => {
    delete process.env['INTERNAL_SECRET'];
    delete process.env['CRON_SECRET'];
    const res = await post('/internal/cleanup-tokens', { Authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(401);
    expect(mockCleanupExpiredTokens).not.toHaveBeenCalled();
  });

  it('treats an empty/whitespace-only configured secret as unset (fail closed)', async () => {
    // Both secrets present but blank → no real secret is configured, so even an
    // empty presented secret must NOT authenticate.
    process.env['INTERNAL_SECRET'] = '';
    process.env['CRON_SECRET'] = '   ';
    const empty = await post('/internal/cleanup-tokens', { 'x-internal-secret': '' });
    expect(empty.status).toBe(401);
    const whitespace = await post('/internal/cleanup-tokens', { 'x-internal-secret': '   ' });
    expect(whitespace.status).toBe(401);
    expect(mockCleanupExpiredTokens).not.toHaveBeenCalled();
  });

  it('rejects an empty presented secret against a real configured secret', async () => {
    process.env['INTERNAL_SECRET'] = SECRET;
    const res = await post('/internal/cleanup-tokens', { 'x-internal-secret': '' });
    expect(res.status).toBe(401);
    expect(mockCleanupExpiredTokens).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Vercel Cron: GET requests authenticated by the auto-injected CRON_SECRET
// ---------------------------------------------------------------------------

describe('internal routes — Vercel Cron (GET + CRON_SECRET)', () => {
  const CRON_SECRET = 'vercel-injected-cron-secret';

  it('authenticates a GET cron request via Authorization: Bearer <CRON_SECRET>', async () => {
    process.env['CRON_SECRET'] = CRON_SECRET;
    mockCleanupExpiredTokens.mockImplementation(() => Promise.resolve(4));
    const res = await get('/internal/cleanup-tokens', {
      Authorization: `Bearer ${CRON_SECRET}`,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: number };
    expect(body.deleted).toBe(4);
    expect(mockCleanupExpiredTokens).toHaveBeenCalledTimes(1);
  });

  it('still accepts the manual INTERNAL_SECRET on a GET request when CRON_SECRET is also set', async () => {
    process.env['CRON_SECRET'] = CRON_SECRET;
    const res = await get('/internal/purge-users', { Authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(mockPurgeDeletedUsers).toHaveBeenCalledTimes(1);
  });

  it('rejects a GET request whose bearer token matches neither secret', async () => {
    process.env['CRON_SECRET'] = CRON_SECRET;
    const res = await get('/internal/analytics/compute', { Authorization: 'Bearer nope' });
    expect(res.status).toBe(401);
    expect(mockFetchLeastRecentlyComputedUsers).not.toHaveBeenCalled();
  });

  it('authenticates a GET cron request when ONLY CRON_SECRET is configured', async () => {
    delete process.env['INTERNAL_SECRET'];
    process.env['CRON_SECRET'] = CRON_SECRET;
    const res = await get('/internal/cleanup-tokens', {
      Authorization: `Bearer ${CRON_SECRET}`,
    });
    expect(res.status).toBe(200);
    expect(mockCleanupExpiredTokens).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// cleanup-tokens
// ---------------------------------------------------------------------------

describe('POST /internal/cleanup-tokens', () => {
  it('runs cleanup and returns the deleted count with the correct secret', async () => {
    mockCleanupExpiredTokens.mockImplementation(() => Promise.resolve(7));
    const res = await post('/internal/cleanup-tokens', { Authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: number };
    expect(body.deleted).toBe(7);
    expect(mockCleanupExpiredTokens).toHaveBeenCalledTimes(1);
  });

  it('accepts the secret via the x-internal-secret header', async () => {
    const res = await post('/internal/cleanup-tokens', { 'x-internal-secret': SECRET });
    expect(res.status).toBe(200);
    expect(mockCleanupExpiredTokens).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// purge-users
// ---------------------------------------------------------------------------

describe('POST /internal/purge-users', () => {
  it('runs the purge and returns its summary', async () => {
    mockPurgeDeletedUsers.mockImplementation(() =>
      Promise.resolve({ purged: 3, cutoff: '2026-05-27T12:00:00.000Z' })
    );
    const res = await post('/internal/purge-users', { Authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as PurgeSummary;
    expect(body.purged).toBe(3);
    expect(body.cutoff).toBe('2026-05-27T12:00:00.000Z');
    expect(mockPurgeDeletedUsers).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// analytics/compute
// ---------------------------------------------------------------------------

describe('POST /internal/analytics/compute', () => {
  function users(n: number): { userId: string }[] {
    return Array.from({ length: n }, (_, i) => ({ userId: `u${i}` }));
  }

  it('processes the batch and reports processed/errors/batchSize', async () => {
    process.env['ANALYTICS_BATCH_SIZE'] = '3';
    mockFetchLeastRecentlyComputedUsers.mockImplementation((limit) =>
      Promise.resolve(users(limit))
    );
    const res = await post('/internal/analytics/compute', { Authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { processed: number; errors: number; batchSize: number };
    expect(body).toEqual({ processed: 3, errors: 0, batchSize: 3 });
    expect(mockFetchLeastRecentlyComputedUsers).toHaveBeenCalledWith(3);
    expect(mockComputeUser).toHaveBeenCalledTimes(3);
  });

  it('defaults to a batch size of 50 when ANALYTICS_BATCH_SIZE is unset', async () => {
    mockFetchLeastRecentlyComputedUsers.mockImplementation(() => Promise.resolve([]));
    const res = await post('/internal/analytics/compute', { Authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { batchSize: number };
    expect(body.batchSize).toBe(50);
    expect(mockFetchLeastRecentlyComputedUsers).toHaveBeenCalledWith(50);
  });

  it('never asks for more than the configured batch bound', async () => {
    process.env['ANALYTICS_BATCH_SIZE'] = '2';
    // The query layer is the bound: even if it returned more, the route requests
    // exactly the configured limit. Here it honours the limit it is given.
    mockFetchLeastRecentlyComputedUsers.mockImplementation((limit) =>
      Promise.resolve(users(Math.min(limit, 2)))
    );
    const res = await post('/internal/analytics/compute', { Authorization: `Bearer ${SECRET}` });
    const body = (await res.json()) as { processed: number; batchSize: number };
    expect(body.batchSize).toBe(2);
    expect(body.processed).toBe(2);
    expect(mockFetchLeastRecentlyComputedUsers).toHaveBeenCalledWith(2);
  });

  it('counts per-user failures as errors without aborting the batch', async () => {
    process.env['ANALYTICS_BATCH_SIZE'] = '3';
    mockFetchLeastRecentlyComputedUsers.mockImplementation((limit) =>
      Promise.resolve(users(limit))
    );
    mockComputeUser.mockImplementation((userId: string) =>
      userId === 'u1' ? Promise.reject(new Error('boom')) : Promise.resolve()
    );
    const res = await post('/internal/analytics/compute', { Authorization: `Bearer ${SECRET}` });
    const body = (await res.json()) as { processed: number; errors: number };
    expect(body.processed).toBe(2);
    expect(body.errors).toBe(1);
    expect(mockComputeUser).toHaveBeenCalledTimes(3);
  });
});
