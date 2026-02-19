/**
 * Auth routes integration tests — uses Elysia's .handle() method, no real server.
 * DB-dependent services are mocked via mock.module().
 */
process.env['JWT_SECRET'] = 'test-secret-must-be-at-least-32-chars-1234';
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TEST_USER = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: '$argon2id$v=19$m=65536,t=2,p=1$...',
  name: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
} as const;

const TEST_REFRESH_TOKEN = {
  id: 'rt-uuid',
  userId: 'user-123',
  tokenHash: 'a'.repeat(64),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// Mocks — must be called BEFORE importing the tested module
// ---------------------------------------------------------------------------

const mockHashPassword = mock(() => Promise.resolve('hashed-password'));
const mockVerifyPassword = mock(() => Promise.resolve(true));
const mockHashToken = mock(() => Promise.resolve('a'.repeat(64)));
const mockGenerateRefreshToken = mock(() => 'mock-refresh-token');
const mockCreateUser = mock(() => Promise.resolve({ ...TEST_USER }));
const mockFindUserByEmail = mock<() => Promise<typeof TEST_USER | undefined>>(() =>
  Promise.resolve(undefined)
);
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
const mockCreatePasswordResetToken = mock(() => Promise.resolve('raw-reset-token-uuid'));
const mockFindPasswordResetToken = mock<
  () => Promise<
    | {
        id: string;
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        usedAt: Date | null;
        createdAt: Date;
      }
    | undefined
  >
>(() => Promise.resolve(undefined));
const mockMarkPasswordResetTokenUsed = mock(() => Promise.resolve());

mock.module('../services/auth', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
  hashToken: mockHashToken,
  generateRefreshToken: mockGenerateRefreshToken,
  createUser: mockCreateUser,
  findUserByEmail: mockFindUserByEmail,
  findUserById: mockFindUserById,
  findRefreshToken: mockFindRefreshToken,
  findRefreshTokenByPreviousHash: mockFindRefreshTokenByPreviousHash,
  revokeRefreshToken: mockRevokeRefreshToken,
  revokeAllUserTokens: mockRevokeAllUserTokens,
  createAndStoreRefreshToken: mockCreateAndStoreRefreshToken,
  createPasswordResetToken: mockCreatePasswordResetToken,
  findPasswordResetToken: mockFindPasswordResetToken,
  markPasswordResetTokenUsed: mockMarkPasswordResetTokenUsed,
  REFRESH_TOKEN_DAYS: 7,
}));

const mockCheckLeakedPassword = mock(() => Promise.resolve(false));
mock.module('../lib/password-check', () => ({
  checkLeakedPassword: mockCheckLeakedPassword,
}));

mock.module('../lib/email', () => ({
  sendPasswordResetEmail: mock(() => Promise.resolve()),
}));

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): void => {
    /* no-op */
  },
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
// POST /auth/signup
// ---------------------------------------------------------------------------

describe('POST /auth/signup', () => {
  beforeEach(() => {
    mockCheckLeakedPassword.mockImplementation(() => Promise.resolve(false));
    mockFindUserByEmail.mockImplementation(() => Promise.resolve(undefined));
    mockCreateUser.mockImplementation(() => Promise.resolve({ ...TEST_USER }));
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('mock-raw-refresh-token')
    );
  });

  it('returns 400 for missing required fields', async () => {
    const res = await post('/auth/signup', { email: 'bad-not-email' });
    expect(res.status).toBe(400);
  });

  it('returns 400 with WEAK_PASSWORD when password is leaked', async () => {
    mockCheckLeakedPassword.mockImplementation(() => Promise.resolve(true));

    const res = await post('/auth/signup', {
      email: 'user@example.com',
      password: 'password123456',
    });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(400);
    expect(body.code).toBe('WEAK_PASSWORD');
  });

  it('returns 409 with AUTH_EMAIL_EXISTS when email is already registered', async () => {
    mockCheckLeakedPassword.mockImplementation(() => Promise.resolve(false));
    mockFindUserByEmail.mockImplementation(() => Promise.resolve({ ...TEST_USER }));

    const res = await post('/auth/signup', {
      email: 'test@example.com',
      password: 'ValidPass123!',
    });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(409);
    expect(body.code).toBe('AUTH_EMAIL_EXISTS');
  });

  it('returns 201 with accessToken and user.email on success', async () => {
    const res = await post('/auth/signup', {
      email: 'new@example.com',
      password: 'ValidPass123!',
    });
    const body = (await res.json()) as { accessToken: string; user: { email: string } };

    expect(res.status).toBe(201);
    expect(typeof body.accessToken).toBe('string');
    expect(body.user.email).toBe(TEST_USER.email);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/signin
// ---------------------------------------------------------------------------

describe('POST /auth/signin', () => {
  beforeEach(() => {
    mockFindUserByEmail.mockImplementation(() => Promise.resolve({ ...TEST_USER }));
    mockVerifyPassword.mockImplementation(() => Promise.resolve(true));
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('mock-raw-refresh-token')
    );
  });

  it('returns 400 for missing fields', async () => {
    const res = await post('/auth/signin', { email: 'user@example.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 with AUTH_INVALID_CREDENTIALS when user not found', async () => {
    mockFindUserByEmail.mockImplementation(() => Promise.resolve(undefined));

    const res = await post('/auth/signin', {
      email: 'nobody@example.com',
      password: 'ValidPass123!',
    });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('returns 401 with AUTH_INVALID_CREDENTIALS when password is wrong', async () => {
    mockFindUserByEmail.mockImplementation(() => Promise.resolve({ ...TEST_USER }));
    mockVerifyPassword.mockImplementation(() => Promise.resolve(false));

    const res = await post('/auth/signin', {
      email: 'test@example.com',
      password: 'WrongPassword!',
    });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('returns 200 with accessToken on success', async () => {
    const res = await post('/auth/signin', {
      email: 'test@example.com',
      password: 'ValidPass123!',
    });
    const body = (await res.json()) as { accessToken: string };

    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
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
  const secret = process.env['JWT_SECRET'] ?? '';
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

// ---------------------------------------------------------------------------
// POST /auth/forgot-password
// ---------------------------------------------------------------------------

describe('POST /auth/forgot-password', () => {
  it('returns 200 even when the email is not registered (no enumeration)', async () => {
    mockFindUserByEmail.mockImplementation(() => Promise.resolve(undefined));

    const res = await post('/auth/forgot-password', { email: 'nobody@example.com' });
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(200);
    expect(typeof body.message).toBe('string');
  });

  it('returns 200 and triggers a reset token when the email is registered', async () => {
    mockFindUserByEmail.mockImplementation(() => Promise.resolve({ ...TEST_USER }));
    mockCreatePasswordResetToken.mockImplementation(() => Promise.resolve('raw-reset-token'));

    const res = await post('/auth/forgot-password', { email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(mockCreatePasswordResetToken).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for an invalid email format', async () => {
    const res = await post('/auth/forgot-password', { email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/reset-password
// ---------------------------------------------------------------------------

const TEST_RESET_TOKEN_ROW = {
  id: 'rt-uuid',
  userId: 'user-123',
  tokenHash: 'a'.repeat(64),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  usedAt: null,
  createdAt: new Date(),
};

describe('POST /auth/reset-password', () => {
  beforeEach(() => {
    mockCheckLeakedPassword.mockImplementation(() => Promise.resolve(false));
    mockFindPasswordResetToken.mockImplementation(() =>
      Promise.resolve({ ...TEST_RESET_TOKEN_ROW })
    );
    mockMarkPasswordResetTokenUsed.mockImplementation(() => Promise.resolve());
  });

  it('returns 400 with RESET_TOKEN_INVALID when token is not found', async () => {
    mockFindPasswordResetToken.mockImplementation(() => Promise.resolve(undefined));

    const res = await post('/auth/reset-password', {
      token: 'unknown-token',
      password: 'NewStrongPass1!',
    });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(400);
    expect(body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('returns 400 with WEAK_PASSWORD when the new password is leaked', async () => {
    mockCheckLeakedPassword.mockImplementation(() => Promise.resolve(true));

    const res = await post('/auth/reset-password', {
      token: 'valid-token',
      password: 'password123456',
    });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(400);
    expect(body.code).toBe('WEAK_PASSWORD');
  });

  it('returns 200 and marks the token used on success', async () => {
    const res = await post('/auth/reset-password', {
      token: 'valid-token',
      password: 'NewStrongPass1!',
    });
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(200);
    expect(typeof body.message).toBe('string');
    expect(mockMarkPasswordResetTokenUsed).toHaveBeenCalledTimes(1);
  });
});
