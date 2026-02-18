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
const mockCreateAndStoreRefreshToken = mock(() => Promise.resolve('mock-raw-refresh-token'));

mock.module('../services/auth', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
  hashToken: mockHashToken,
  generateRefreshToken: mockGenerateRefreshToken,
  createUser: mockCreateUser,
  findUserByEmail: mockFindUserByEmail,
  findUserById: mockFindUserById,
  findRefreshToken: mockFindRefreshToken,
  revokeRefreshToken: mockRevokeRefreshToken,
  createAndStoreRefreshToken: mockCreateAndStoreRefreshToken,
  REFRESH_TOKEN_DAYS: 7,
}));

const mockCheckLeakedPassword = mock(() => Promise.resolve(false));
mock.module('../lib/password-check', () => ({
  checkLeakedPassword: mockCheckLeakedPassword,
}));

mock.module('../middleware/rate-limit', () => ({
  rateLimit: (): void => {
    /* no-op */
  },
}));

import { authRoutes } from './auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return authRoutes.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

function get(path: string, headers?: Record<string, string>): Promise<Response> {
  return authRoutes.handle(new Request(`http://localhost${path}`, { headers }));
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

    const res = await post('/auth/refresh', {}, { Cookie: 'refresh_token=some-token-value' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_REFRESH');
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

describe('GET /auth/me', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const res = await get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await get('/auth/me', { Authorization: 'Bearer invalid-token' });
    expect(res.status).toBe(401);
  });
});
