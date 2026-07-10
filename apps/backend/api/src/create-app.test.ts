/**
 * Tests for the createApp() factory — exercises GET /api/health against the real
 * app instance instead of duplicating endpoint logic inline.
 */
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['LOG_LEVEL'] = 'silent';
process.env['JWT_SECRET'] = 'test-secret-must-be-at-least-32-chars-1234';

import { describe, it, expect, vi } from 'vitest';
import { Elysia } from 'elysia';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that trigger side-effects
// ---------------------------------------------------------------------------

vi.mock('./lib/sentry', () => ({
  captureException: vi.fn(() => {}),
  flushSentry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/redis', () => ({
  getRedis: vi.fn(() => undefined),
}));

vi.mock('./db', () => ({
  getDb: vi.fn(() => ({
    execute: vi.fn(() => Promise.resolve([{ '?column?': 1 }])),
  })),
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

describe('GET /api/health', () => {
  it('response includes redis field', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'));
    const body = (await res.json()) as Record<string, unknown>;
    expect('redis' in body).toBe(true);
  });

  it('redis.status === "disabled" when REDIS_URL is not set', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'));
    const body = (await res.json()) as Record<string, unknown>;
    const redis = body.redis as Record<string, unknown>;
    expect(redis.status).toBe('disabled');
  });

  it('returns 200 when db is healthy', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
  });

  it('response includes status, timestamp, and db fields', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'));
    const body = (await res.json()) as Record<string, unknown>;
    expect('status' in body).toBe(true);
    expect('timestamp' in body).toBe(true);
    expect('db' in body).toBe(true);
  });

  it('omits the stateless-incompatible uptime field', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'));
    const body = (await res.json()) as Record<string, unknown>;
    expect('uptime' in body).toBe(false);
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
