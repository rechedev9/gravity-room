/**
 * Tests for the createApp() factory — exercises GET /health against the real
 * app instance instead of duplicating endpoint logic inline.
 */
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['LOG_LEVEL'] = 'silent';
process.env['JWT_SECRET'] = 'test-secret-must-be-at-least-32-chars-1234';

import { mock, describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that trigger side-effects
// ---------------------------------------------------------------------------

mock.module('./lib/sentry', () => ({
  captureException: mock(() => {}),
}));

mock.module('./lib/redis', () => ({
  getRedis: mock(() => undefined),
}));

mock.module('./db', () => ({
  getDb: mock(() => ({
    execute: mock(() => Promise.resolve([{ '?column?': 1 }])),
  })),
  closeDb: mock(() => Promise.resolve()),
}));

mock.module('./middleware/request-logger', () => ({
  requestLogger: new Elysia({ name: 'request-logger-mock' }),
}));

mock.module('./plugins/swagger', () => ({
  swaggerPlugin: new Elysia({ name: 'swagger-plugin-mock' }),
}));

mock.module('./plugins/metrics', () => ({
  metricsPlugin: new Elysia({ name: 'metrics-plugin-mock' }),
}));

// ---------------------------------------------------------------------------
// SUT
// ---------------------------------------------------------------------------

import { createApp } from './create-app';

const app = createApp({
  corsOrigins: '*',
  csp: "default-src 'self'",
  permissionsPolicy: '',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('response includes redis field', async () => {
    const res = await app.handle(new Request('http://localhost/health'));
    const body = (await res.json()) as Record<string, unknown>;
    expect('redis' in body).toBe(true);
  });

  it('redis.status === "disabled" when REDIS_URL is not set', async () => {
    const res = await app.handle(new Request('http://localhost/health'));
    const body = (await res.json()) as Record<string, unknown>;
    const redis = body.redis as Record<string, unknown>;
    expect(redis.status).toBe('disabled');
  });

  it('returns 200 when db is healthy', async () => {
    const res = await app.handle(new Request('http://localhost/health'));
    expect(res.status).toBe(200);
  });

  it('response includes status, timestamp, uptime, and db fields', async () => {
    const res = await app.handle(new Request('http://localhost/health'));
    const body = (await res.json()) as Record<string, unknown>;
    expect('status' in body).toBe(true);
    expect('timestamp' in body).toBe(true);
    expect('uptime' in body).toBe(true);
    expect('db' in body).toBe(true);
  });
});

describe('GET /metrics auth gate', () => {
  const withEnv = async (
    env: { NODE_ENV?: string; METRICS_TOKEN?: string },
    authHeader?: string
  ) => {
    const prevNodeEnv = process.env['NODE_ENV'];
    const prevToken = process.env['METRICS_TOKEN'];
    if (env.NODE_ENV === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = env.NODE_ENV;
    if (env.METRICS_TOKEN === undefined) delete process.env['METRICS_TOKEN'];
    else process.env['METRICS_TOKEN'] = env.METRICS_TOKEN;
    try {
      const localApp = createApp({
        corsOrigins: '*',
        csp: "default-src 'self'",
        permissionsPolicy: '',
      });
      return await localApp.handle(
        new Request('http://localhost/metrics', {
          headers: authHeader ? { authorization: authHeader } : {},
        })
      );
    } finally {
      if (prevNodeEnv === undefined) delete process.env['NODE_ENV'];
      else process.env['NODE_ENV'] = prevNodeEnv;
      if (prevToken === undefined) delete process.env['METRICS_TOKEN'];
      else process.env['METRICS_TOKEN'] = prevToken;
    }
  };

  it('is open without a token in local dev (NODE_ENV unset)', async () => {
    const res = await withEnv({ NODE_ENV: undefined, METRICS_TOKEN: undefined });
    expect(res.status).toBe(200);
  });

  it('fails closed without a token outside dev/test (e.g. staging)', async () => {
    const res = await withEnv({ NODE_ENV: 'staging', METRICS_TOKEN: undefined });
    expect(res.status).toBe(401);
  });

  it('enforces the bearer token when configured', async () => {
    const unauth = await withEnv({ NODE_ENV: 'staging', METRICS_TOKEN: 'super-secret' });
    expect(unauth.status).toBe(401);
    const authed = await withEnv(
      { NODE_ENV: 'staging', METRICS_TOKEN: 'super-secret' },
      'Bearer super-secret'
    );
    expect(authed.status).toBe(200);
  });
});

describe('security headers', () => {
  it('are present on success responses', async () => {
    const res = await app.handle(new Request('http://localhost/health'));
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
