/**
 * Auth routes integration tests — uses Elysia's .handle() method, no real server.
 * DB-dependent services and the Google token verifier are mocked via mock.module().
 */
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect, beforeEach, afterAll } from 'bun:test';

afterAll(() => {
  mock.restore();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_USER = {
  id: 'user-123',
  email: 'test@example.com',
  googleId: 'google-uid-123',
  name: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
} as const;

const TEST_REFRESH_TOKEN = {
  id: 'rt-uuid',
  userId: 'user-123',
  tokenHash: 'a'.repeat(64),
  previousTokenHash: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

const mockHashToken = mock(() => Promise.resolve('a'.repeat(64)));
const mockFindUserById = mock<() => Promise<typeof TEST_USER | undefined>>(() =>
  Promise.resolve({ ...TEST_USER })
);
const mockFindRefreshToken = mock<() => Promise<typeof TEST_REFRESH_TOKEN | undefined>>(() =>
  Promise.resolve(undefined)
);
const mockRevokeRefreshToken = mock(() => Promise.resolve());
const mockRevokeAllUserTokens = mock(() => Promise.resolve());
const mockFindRefreshTokenByPreviousHash = mock<
  () => Promise<typeof TEST_REFRESH_TOKEN | undefined>
>(() => Promise.resolve(undefined));
const mockCreateAndStoreRefreshToken = mock(() => Promise.resolve('mock-raw-refresh-token'));
const mockFindOrCreateGoogleUser = mock<() => Promise<typeof TEST_USER>>(() =>
  Promise.resolve({ ...TEST_USER })
);

mock.module('../services/auth', () => ({
  hashToken: mockHashToken,
  findUserById: mockFindUserById,
  findRefreshToken: mockFindRefreshToken,
  findRefreshTokenByPreviousHash: mockFindRefreshTokenByPreviousHash,
  revokeRefreshToken: mockRevokeRefreshToken,
  revokeAllUserTokens: mockRevokeAllUserTokens,
  createAndStoreRefreshToken: mockCreateAndStoreRefreshToken,
  findOrCreateGoogleUser: mockFindOrCreateGoogleUser,
  REFRESH_TOKEN_DAYS: 7,
}));

const mockVerifyGoogleToken = mock(() =>
  Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
);

mock.module('../lib/google-auth', () => ({
  verifyGoogleToken: mockVerifyGoogleToken,
}));

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): Promise<void> => Promise.resolve(),
}));

import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { authRoutes } from './auth';

// Wrap authRoutes with the same error-handling logic as the main app so that
// ApiError instances are serialized to JSON in tests.
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
    set.status = 500;
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  .use(authRoutes);

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

function get(path: string, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(new Request(`http://localhost${path}`, { headers }));
}

// ---------------------------------------------------------------------------
// POST /auth/google
// ---------------------------------------------------------------------------

describe('POST /auth/google', () => {
  beforeEach(() => {
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
    );
    mockFindOrCreateGoogleUser.mockImplementation(() => Promise.resolve({ ...TEST_USER }));
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('mock-raw-refresh-token')
    );
  });

  it('returns 400 for missing credential', async () => {
    const res = await post('/auth/google', {});
    expect(res.status).toBe(400);
  });

  it('returns 401 with AUTH_GOOGLE_INVALID when token verification fails', async () => {
    mockVerifyGoogleToken.mockImplementation(() => Promise.reject(new Error('Invalid signature')));

    const res = await post('/auth/google', { credential: 'bad-token' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_GOOGLE_INVALID');
  });

  it('returns 200 with accessToken and user on success', async () => {
    const res = await post('/auth/google', { credential: 'valid-id-token' });
    const body = (await res.json()) as { accessToken: string; user: { email: string } };

    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
    expect(body.user.email).toBe(TEST_USER.email);
  });

  it('calls findOrCreateGoogleUser with the sub and email from the token', async () => {
    await post('/auth/google', { credential: 'valid-id-token' });

    expect(mockFindOrCreateGoogleUser).toHaveBeenCalledWith(
      'google-uid-123',
      'test@example.com',
      'Test User'
    );
  });
});

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------

describe('POST /auth/refresh', () => {
  it('returns 401 with AUTH_NO_REFRESH_TOKEN when no cookie is present', async () => {
    const res = await post('/auth/refresh', {});
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_NO_REFRESH_TOKEN');
  });

  it('returns 401 with AUTH_INVALID_REFRESH when token is not found in DB', async () => {
    mockFindRefreshToken.mockImplementation(() => Promise.resolve(undefined));
    mockFindRefreshTokenByPreviousHash.mockImplementation(() => Promise.resolve(undefined));

    const res = await post('/auth/refresh', {}, { Cookie: 'refresh_token=some-token-value' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_REFRESH');
  });

  it('revokes all user sessions when a rotated-away token is reused (theft detection)', async () => {
    mockFindRefreshToken.mockImplementation(() => Promise.resolve(undefined));
    // Successor token exists → the presented token was already rotated
    mockFindRefreshTokenByPreviousHash.mockImplementation(() =>
      Promise.resolve({ ...TEST_REFRESH_TOKEN })
    );

    const res = await post('/auth/refresh', {}, { Cookie: 'refresh_token=stolen-old-token' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_REFRESH');
    expect(mockRevokeAllUserTokens).toHaveBeenCalledTimes(1);
  });

  it('returns 200 with a new accessToken when a valid refresh token is provided', async () => {
    mockFindRefreshToken.mockImplementation(() => Promise.resolve(TEST_REFRESH_TOKEN));
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('new-raw-refresh-token')
    );

    const res = await post('/auth/refresh', {}, { Cookie: 'refresh_token=some-token-value' });
    const body = (await res.json()) as { accessToken: string };

    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

/**
 * Builds a real HS256 JWT signed with the test secret but with exp set in
 * the past — proves the JWT plugin enforces expiry (not just bad signatures).
 */
async function makeExpiredJwt(userId: string): Promise<string> {
  // Match the secret auth-guard captured at import time (before any test body overrides it)
  const secret = process.env['JWT_SECRET'] ?? 'dev-secret-change-me';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) - 3600 })
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

describe('GET /auth/me', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const res = await get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await get('/auth/me', { Authorization: 'Bearer invalid-token' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when the access token is expired', async () => {
    const expiredToken = await makeExpiredJwt('user-123');
    const res = await get('/auth/me', { Authorization: `Bearer ${expiredToken}` });
    expect(res.status).toBe(401);
  });
});
