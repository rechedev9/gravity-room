process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['LOG_LEVEL'] = 'silent';
process.env['JWT_SECRET'] = 'test-secret-must-be-at-least-32-chars-1234';

import { Elysia } from 'elysia';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./lib/sentry', () => ({
  captureException: vi.fn(() => undefined),
  flushSentry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./lib/redis', () => ({ getRedis: vi.fn(() => undefined) }));
vi.mock('./db', () => ({
  getDb: vi.fn(() => ({ execute: vi.fn(() => Promise.resolve([])) })),
  closeDb: vi.fn(() => Promise.resolve()),
}));
vi.mock('./plugins/swagger', () => ({
  swaggerPlugin: new Elysia({ name: 'swagger-plugin-fetch-test' }),
}));

import { createApp } from './create-app';

function newApp() {
  return createApp({
    corsOrigins: '*',
    csp: "default-src 'self'",
    permissionsPolicy: '',
  });
}

describe('real createApp().fetch error paths', () => {
  it.each(['/api/', '/api/nope', '/api/swagger/json', '/api/metrics'])(
    'returns a controlled JSON 404 for %s',
    async (path) => {
      const response = await newApp().fetch(new Request(`http://localhost${path}`));

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: 'Not found', code: 'NOT_FOUND' });
      expect(response.headers.get('x-request-id')).toMatch(/^[\w-]{8,64}$/);
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    }
  );

  it('contains an exception thrown after routing instead of rejecting app.fetch', async () => {
    const app = newApp().get('/security-test/throw', () => {
      throw new Error('sensitive early failure');
    });

    const response = await app.fetch(new Request('http://localhost/security-test/throw'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(response.headers.get('x-request-id')).toMatch(/^[\w-]{8,64}$/);
  });

  it('contains an onRequest body-limit error before logger derivation', async () => {
    const response = await newApp().fetch(
      new Request('http://localhost/api/auth/google', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(2 * 1024 * 1024 + 1),
        },
        body: '{}',
      })
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(response.headers.get('x-request-id')).toMatch(/^[\w-]{8,64}$/);
  });
});
