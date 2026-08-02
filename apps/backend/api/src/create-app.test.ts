/**
 * Tests for the createApp() factory — exercises GET /api/health against the real
 * app instance instead of duplicating endpoint logic inline.
 */
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['LOG_LEVEL'] = 'silent';
process.env['JWT_SECRET'] = 'test-secret-must-be-at-least-32-chars-1234';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Elysia } from 'elysia';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that trigger side-effects
// ---------------------------------------------------------------------------

const { mockDbExecute, mockRedisPing } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(() => Promise.resolve([{ '?column?': 1 }])),
  mockRedisPing: vi.fn(() => Promise.resolve('PONG')),
}));

vi.mock('./lib/sentry', () => ({
  captureException: vi.fn(() => {}),
  flushSentry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/redis', () => ({
  getRedis: vi.fn(() => ({ ping: mockRedisPing })),
}));

vi.mock('./db', () => ({
  getDb: vi.fn(() => ({ execute: mockDbExecute })),
  closeDb: vi.fn(() => Promise.resolve()),
}));

vi.mock('./middleware/request-logger', () => ({
  requestLogger: new Elysia({ name: 'request-logger-mock' }),
}));

vi.mock('./plugins/swagger', () => ({
  swaggerPlugin: new Elysia({ name: 'swagger-plugin-mock' }),
}));

// ---------------------------------------------------------------------------
// SUT
// ---------------------------------------------------------------------------

import { createApp } from './create-app';
import { ApiError } from './middleware/error-handler';

const app = createApp({
  corsOrigins: '*',
  csp: "default-src 'self'",
  permissionsPolicy: '',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockDbExecute.mockClear();
  mockRedisPing.mockClear();
});

describe('GET /api/health', () => {
  it('remains a stable public liveness response for Vercel monitoring', async () => {
    const res = await app.fetch(new Request('http://localhost/api/health'));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });

  it('does not call Postgres or Redis', async () => {
    await app.fetch(new Request('http://localhost/api/health'));

    expect(mockDbExecute).not.toHaveBeenCalled();
    expect(mockRedisPing).not.toHaveBeenCalled();
  });

  it('contains no dependency diagnostics or process uptime', async () => {
    const res = await app.fetch(new Request('http://localhost/api/health'));
    const body = (await res.json()) as Record<string, unknown>;

    expect('db' in body).toBe(false);
    expect('redis' in body).toBe(false);
    expect('uptime' in body).toBe(false);
  });

  it('allows a short shared-cache lifetime without browser freshness', async () => {
    const res = await app.fetch(new Request('http://localhost/api/health'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=10');
  });
});

describe('request body limit', () => {
  it('rejects oversized bodies before route parsing', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/auth/google', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(2 * 1024 * 1024 + 1),
        },
        body: '{}',
      })
    );
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(413);
    expect(body).toEqual({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
  });

  it('rejects oversized chunked bodies without a content-length header', async () => {
    const oversizedChunk = new TextEncoder().encode('x'.repeat(2 * 1024 * 1024 + 1));
    const res = await app.handle(
      new Request('http://localhost/api/auth/google', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new Blob([oversizedChunk]),
      })
    );
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(413);
    expect(body).toEqual({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
  });

  it('reconstructs an allowed chunked body for downstream parsing', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/programs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new Blob([JSON.stringify({ programId: 'gzclp', name: 'Test', config: {} })]),
      })
    );
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });
});

describe('security headers', () => {
  it('are present on success responses', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'));
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
  });

  it('are present on error responses too (onAfterHandle does not run on throw)', async () => {
    const res = await app.handle(new Request('http://localhost/does-not-exist'));
    expect(res.status).toBe(404);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
  });
});

describe('server error disclosure', () => {
  it('redacts 5xx ApiError messages and details while preserving the machine code', async () => {
    const errorApp = createApp({
      corsOrigins: '*',
      csp: "default-src 'self'",
      permissionsPolicy: '',
    }).get('/security-test/internal-error', () => {
      throw new ApiError(500, 'postgres://secret@internal/db', 'DB_WRITE_ERROR', {
        details: { query: 'SELECT secret_column' },
      });
    });

    const res = await errorApp.handle(new Request('http://localhost/security-test/internal-error'));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error', code: 'DB_WRITE_ERROR' });
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});
