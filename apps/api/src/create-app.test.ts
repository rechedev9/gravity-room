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
