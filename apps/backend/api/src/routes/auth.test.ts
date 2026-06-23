/**
 * Auth routes integration tests — uses Elysia's .handle() method, no real server.
 * DB-dependent services and the Google token verifier are mocked via mock.module().
 */
process.env['LOG_LEVEL'] = 'silent';
process.env['GOOGLE_CLIENT_ID'] = 'web-client-id';
process.env['GOOGLE_CLIENT_IDS'] = 'mobile-client-id';

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

type MockRotateRefreshTokenResult =
  | { readonly status: 'not_found' }
  | { readonly status: 'expired' }
  | { readonly status: 'account_deleted' }
  | {
      readonly status: 'rotated';
      readonly user: typeof TEST_USER;
      readonly refreshToken: string;
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
const mockRotateRefreshToken = mock<() => Promise<MockRotateRefreshTokenResult>>(() =>
  Promise.resolve({
    status: 'rotated' as const,
    user: { ...TEST_USER },
    refreshToken: 'new-raw-refresh-token',
  })
);
const mockFindOrCreateGoogleUser = mock<
  () => Promise<{ user: typeof TEST_USER; isNewUser: boolean }>
>(() => Promise.resolve({ user: { ...TEST_USER }, isNewUser: false }));

// Fuller user shape for the email/password paths (mutable booleans, nullable fields).
interface MockUserRow {
  id: string;
  email: string;
  googleId: string | null;
  passwordHash: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PW_USER: MockUserRow = {
  id: 'user-123',
  email: 'test@example.com',
  googleId: null,
  passwordHash: 'argon2-hash',
  emailVerified: true,
  name: null,
  avatarUrl: null,
  deletedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockFindUserByEmail = mock<() => Promise<MockUserRow | undefined>>(() =>
  Promise.resolve(undefined)
);
// hashPassword is intentionally NOT mocked — it is a pure Bun.password call that
// needs no DB, and mocking it here leaks into the service unit tests (Bun's
// mock.module is process-global). Letting it run real keeps both suites correct.
const mockAuthenticatePassword = mock<() => Promise<MockUserRow | null>>(() =>
  Promise.resolve(null)
);
const mockCreatePasswordUser = mock<() => Promise<MockUserRow>>(() =>
  Promise.resolve({ ...PW_USER })
);
const mockCreateEmailVerificationToken = mock(() => Promise.resolve('verify-token'));
const mockConsumeEmailVerificationToken = mock<() => Promise<string | null>>(() =>
  Promise.resolve(null)
);
const mockMarkEmailVerified = mock<() => Promise<MockUserRow | undefined>>(() =>
  Promise.resolve({ ...PW_USER })
);
const mockCreatePasswordResetToken = mock(() => Promise.resolve('reset-token'));
const mockConsumePasswordResetToken = mock<() => Promise<string | null>>(() =>
  Promise.resolve(null)
);
const mockSetUserPassword = mock(() => Promise.resolve());
const mockFindOrCreateUserByIdentity = mock<
  () => Promise<{ user: MockUserRow; isNewUser: boolean }>
>(() => Promise.resolve({ user: { ...PW_USER }, isNewUser: false }));
const mockGenerateRefreshToken = mock(() => 'state-fixed-123');

mock.module('../services/auth', () => ({
  hashToken: mockHashToken,
  findUserById: mockFindUserById,
  findUserByEmail: mockFindUserByEmail,
  findRefreshToken: mockFindRefreshToken,
  findRefreshTokenByPreviousHash: mockFindRefreshTokenByPreviousHash,
  revokeRefreshToken: mockRevokeRefreshToken,
  revokeAllUserTokens: mockRevokeAllUserTokens,
  createAndStoreRefreshToken: mockCreateAndStoreRefreshToken,
  rotateRefreshToken: mockRotateRefreshToken,
  findOrCreateGoogleUser: mockFindOrCreateGoogleUser,
  findOrCreateUserByIdentity: mockFindOrCreateUserByIdentity,
  generateRefreshToken: mockGenerateRefreshToken,
  authenticatePassword: mockAuthenticatePassword,
  createPasswordUser: mockCreatePasswordUser,
  createEmailVerificationToken: mockCreateEmailVerificationToken,
  consumeEmailVerificationToken: mockConsumeEmailVerificationToken,
  markEmailVerified: mockMarkEmailVerified,
  createPasswordResetToken: mockCreatePasswordResetToken,
  consumePasswordResetToken: mockConsumePasswordResetToken,
  setUserPassword: mockSetUserPassword,
  REFRESH_TOKEN_DAYS: 7,
}));

const mockSendVerificationEmail = mock(() => Promise.resolve());
const mockSendPasswordResetEmail = mock(() => Promise.resolve());

mock.module('../lib/email', () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

const mockIsAppleConfigured = mock(() => true);
const mockBuildAppleAuthorizeUrl = mock(
  () => 'https://appleid.apple.com/auth/authorize?client_id=x&state=state-fixed-123'
);
const mockVerifyAppleIdToken = mock<
  () => Promise<{
    sub: string;
    email: string | undefined;
    emailVerified: boolean;
    name: string | undefined;
  }>
>(() =>
  Promise.resolve({
    sub: 'apple-sub',
    email: 'apple@example.com',
    emailVerified: true,
    name: 'Ada',
  })
);
const mockParseAppleUserName = mock<() => string | undefined>(() => undefined);

mock.module('../lib/apple-auth', () => ({
  isAppleConfigured: mockIsAppleConfigured,
  buildAppleAuthorizeUrl: mockBuildAppleAuthorizeUrl,
  verifyAppleIdToken: mockVerifyAppleIdToken,
  parseAppleUserName: mockParseAppleUserName,
}));

const mockIsGitHubConfigured = mock(() => true);
const mockBuildGitHubAuthorizeUrl = mock(
  () => 'https://github.com/login/oauth/authorize?client_id=x&state=state-fixed-123'
);
const mockExchangeGitHubCode = mock(() => Promise.resolve('gho_token'));
const mockFetchGitHubIdentity = mock<
  () => Promise<{ id: string; email: string; emailVerified: boolean; name: string | undefined }>
>(() =>
  Promise.resolve({ id: 'gh-123', email: 'octo@example.com', emailVerified: true, name: 'Octo' })
);

mock.module('../lib/github-auth', () => ({
  isGitHubConfigured: mockIsGitHubConfigured,
  buildGitHubAuthorizeUrl: mockBuildGitHubAuthorizeUrl,
  exchangeGitHubCode: mockExchangeGitHubCode,
  fetchGitHubIdentity: mockFetchGitHubIdentity,
}));

const mockVerifyGoogleToken = mock(() =>
  Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
);

const mockRateLimit = mock<() => Promise<void>>(() => Promise.resolve());

mock.module('../lib/google-auth', () => ({
  verifyGoogleToken: mockVerifyGoogleToken,
}));

mock.module('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

const mockSendTelegramMessage = mock((): void => undefined);

mock.module('../lib/telegram', () => ({
  sendTelegramMessage: mockSendTelegramMessage,
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
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockVerifyGoogleToken.mockClear();
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
    );
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: false })
    );
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('mock-raw-refresh-token')
    );
    mockSendTelegramMessage.mockClear();
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

  it('keeps normalizing ApiError failures from verifyGoogleToken to 401 AUTH_GOOGLE_INVALID', async () => {
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.reject(new ApiError(503, 'JWKS unavailable', 'AUTH_JWKS_UNAVAILABLE'))
    );

    const res = await post('/auth/google', { credential: 'bad-token' });
    const body = (await res.json()) as { code: string; error: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_GOOGLE_INVALID');
    expect(body.error).toBe('Invalid Google credential');
  });

  it('returns 500 CONFIGURATION_ERROR when GOOGLE_CLIENT_ID is absent', async () => {
    const previousClientId = process.env['GOOGLE_CLIENT_ID'];
    delete process.env['GOOGLE_CLIENT_ID'];

    try {
      const res = await post('/auth/google', { credential: 'valid-id-token' });
      const body = (await res.json()) as { code: string; error: string };

      expect(res.status).toBe(500);
      expect(body.code).toBe('CONFIGURATION_ERROR');
      expect(body.error).toBe('GOOGLE_CLIENT_ID env var must be set');
    } finally {
      process.env['GOOGLE_CLIENT_ID'] = previousClientId;
    }
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

  it('verifies web google tokens against only the web client id', async () => {
    await post('/auth/google', { credential: 'valid-id-token' });

    expect(mockVerifyGoogleToken).toHaveBeenCalledWith('valid-id-token', {
      allowedClientIds: ['web-client-id'],
    });
  });
});

// ---------------------------------------------------------------------------
// POST /auth/mobile/google
// ---------------------------------------------------------------------------

describe('POST /auth/mobile/google', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
    );
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: false })
    );
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('mobile-initial-refresh-token')
    );
  });

  it('returns accessToken, refreshToken, and user in the response body', async () => {
    const res = await post('/auth/mobile/google', { credential: 'valid-id-token' });
    const body = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      user: { email: string };
    };

    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
    expect(body.refreshToken).toBe('mobile-initial-refresh-token');
    expect(body.user.email).toBe(TEST_USER.email);
  });

  it('returns 401 with AUTH_GOOGLE_INVALID when token verification fails', async () => {
    mockVerifyGoogleToken.mockImplementation(() => Promise.reject(new Error('Invalid signature')));

    const res = await post('/auth/mobile/google', { credential: 'bad-token' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_GOOGLE_INVALID');
  });

  it('preserves ApiError status and code from verifyGoogleToken', async () => {
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.reject(new ApiError(503, 'JWKS unavailable', 'AUTH_JWKS_UNAVAILABLE'))
    );

    const res = await post('/auth/mobile/google', { credential: 'bad-token' });
    const body = (await res.json()) as { code: string; error: string };

    expect(res.status).toBe(503);
    expect(body.code).toBe('AUTH_JWKS_UNAVAILABLE');
    expect(body.error).toBe('JWKS unavailable');
  });

  it('preserves passthrough 403 ACCOUNT_DELETED errors', async () => {
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.reject(new ApiError(403, 'Account deleted', 'ACCOUNT_DELETED'))
    );

    const res = await post('/auth/mobile/google', { credential: 'bad-token' });
    const body = (await res.json()) as { code: string; error: string };

    expect(res.status).toBe(403);
    expect(body.code).toBe('ACCOUNT_DELETED');
    expect(body.error).toBe('Account deleted');
  });

  it('preserves passthrough 500 internal/configuration errors', async () => {
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.reject(new ApiError(500, 'Database write failed', 'DB_WRITE_ERROR'))
    );

    const res = await post('/auth/mobile/google', { credential: 'bad-token' });
    const body = (await res.json()) as { code: string; error: string };

    expect(res.status).toBe(500);
    expect(body.code).toBe('DB_WRITE_ERROR');
    expect(body.error).toBe('Database write failed');
  });

  it('verifies mobile google tokens against the mobile allowlist with web fallback', async () => {
    await post('/auth/mobile/google', { credential: 'valid-id-token' });

    expect(mockVerifyGoogleToken).toHaveBeenCalledWith('valid-id-token', {
      allowedClientIds: ['mobile-client-id'],
    });
  });

  it('returns 500 CONFIGURATION_ERROR when GOOGLE_CLIENT_IDS is absent', async () => {
    const previousMobileClientIds = process.env['GOOGLE_CLIENT_IDS'];
    delete process.env['GOOGLE_CLIENT_IDS'];

    try {
      const res = await post('/auth/mobile/google', { credential: 'valid-id-token' });
      const body = (await res.json()) as { code: string; error: string };

      expect(res.status).toBe(500);
      expect(body.code).toBe('CONFIGURATION_ERROR');
      expect(body.error).toBe('GOOGLE_CLIENT_IDS env var must be set');
    } finally {
      process.env['GOOGLE_CLIENT_IDS'] = previousMobileClientIds;
    }
  });

  it('returns 429 RATE_LIMITED with the documented error shape when rate limited', async () => {
    mockRateLimit.mockImplementation(() =>
      Promise.reject(new ApiError(429, 'Too many requests', 'RATE_LIMITED'))
    );

    const res = await post('/auth/mobile/google', { credential: 'valid-id-token' });
    const body = (await res.json()) as { code: string; error: string };

    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.error).toBe('Too many requests');
  });
});

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------

describe('POST /auth/refresh', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockRotateRefreshToken.mockImplementation(() =>
      Promise.resolve({
        status: 'rotated',
        user: { ...TEST_USER },
        refreshToken: 'new-raw-refresh-token',
      })
    );
    mockFindRefreshTokenByPreviousHash.mockImplementation(() => Promise.resolve(undefined));
    mockRevokeAllUserTokens.mockClear();
  });

  it('returns 401 with AUTH_NO_REFRESH_TOKEN when no cookie is present', async () => {
    const res = await post('/auth/refresh', {});
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_NO_REFRESH_TOKEN');
  });

  it('returns 401 with AUTH_INVALID_REFRESH when token is not found in DB', async () => {
    mockRotateRefreshToken.mockImplementation(() => Promise.resolve({ status: 'not_found' }));
    mockFindRefreshTokenByPreviousHash.mockImplementation(() => Promise.resolve(undefined));

    const res = await post('/auth/refresh', {}, { Cookie: 'refresh_token=some-token-value' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_REFRESH');
  });

  it('revokes all user sessions when a rotated-away token is reused (theft detection)', async () => {
    mockRotateRefreshToken.mockImplementation(() => Promise.resolve({ status: 'not_found' }));
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
    mockRotateRefreshToken.mockImplementation(() =>
      Promise.resolve({
        status: 'rotated',
        user: { ...TEST_USER },
        refreshToken: 'new-raw-refresh-token',
      })
    );

    const res = await post('/auth/refresh', {}, { Cookie: 'refresh_token=some-token-value' });
    const body = (await res.json()) as { accessToken: string; user: { email: string } };

    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
    // The user is returned alongside the token so the web client restores the
    // session in a single round-trip (no follow-up GET /auth/me).
    expect(body.user.email).toBe(TEST_USER.email);
  });

  it('returns 401 with AUTH_ACCOUNT_DELETED when the token belongs to a soft-deleted user', async () => {
    mockRotateRefreshToken.mockImplementation(() => Promise.resolve({ status: 'account_deleted' }));

    const res = await post('/auth/refresh', {}, { Cookie: 'refresh_token=some-token-value' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_ACCOUNT_DELETED');
  });
});

// ---------------------------------------------------------------------------
// POST /auth/mobile/refresh
// ---------------------------------------------------------------------------

describe('POST /auth/mobile/refresh', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockHashToken.mockClear();
    mockRevokeRefreshToken.mockClear();
    mockRevokeAllUserTokens.mockClear();
    mockCreateAndStoreRefreshToken.mockClear();
    mockRotateRefreshToken.mockImplementation(() =>
      Promise.resolve({
        status: 'rotated',
        user: { ...TEST_USER },
        refreshToken: 'new-mobile-refresh-token',
      })
    );
    mockFindRefreshTokenByPreviousHash.mockImplementation(() => Promise.resolve(undefined));
    mockFindUserById.mockImplementation(() => Promise.resolve({ ...TEST_USER }));
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('new-mobile-refresh-token')
    );
  });

  it('accepts refreshToken in the request body, rotates it, and returns user data', async () => {
    const res = await post('/auth/mobile/refresh', { refreshToken: 'mobile-refresh-token' });
    const body = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string | null; avatarUrl: string | null };
    };

    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
    expect(body.refreshToken).toBe('new-mobile-refresh-token');
    expect(body.user).toEqual({
      id: TEST_USER.id,
      email: TEST_USER.email,
      name: null,
      avatarUrl: null,
    });
    expect(mockRotateRefreshToken).toHaveBeenCalledWith('a'.repeat(64));
  });

  it('returns 401 with AUTH_NO_REFRESH_TOKEN when refreshToken is missing', async () => {
    const res = await post('/auth/mobile/refresh', {});
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_NO_REFRESH_TOKEN');
  });

  it('returns 401 with AUTH_NO_REFRESH_TOKEN when refreshToken is empty', async () => {
    const res = await post('/auth/mobile/refresh', { refreshToken: '' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_NO_REFRESH_TOKEN');
  });

  it('returns 401 with AUTH_INVALID_REFRESH when token is not found in DB', async () => {
    mockRotateRefreshToken.mockImplementation(() => Promise.resolve({ status: 'not_found' }));

    const res = await post('/auth/mobile/refresh', { refreshToken: 'mobile-refresh-token' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_REFRESH');
  });

  it('revokes all user sessions when a rotated-away token is reused', async () => {
    mockRotateRefreshToken.mockImplementation(() => Promise.resolve({ status: 'not_found' }));
    mockFindRefreshTokenByPreviousHash.mockImplementation(() =>
      Promise.resolve({ ...TEST_REFRESH_TOKEN })
    );

    const res = await post('/auth/mobile/refresh', { refreshToken: 'stolen-mobile-token' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_REFRESH');
    expect(mockRevokeAllUserTokens).toHaveBeenCalledTimes(1);
  });

  it('returns 401 with AUTH_REFRESH_EXPIRED when the refresh token is expired', async () => {
    mockRotateRefreshToken.mockImplementation(() => Promise.resolve({ status: 'expired' }));

    const res = await post('/auth/mobile/refresh', { refreshToken: 'expired-mobile-token' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_REFRESH_EXPIRED');
  });

  it('returns 401 with AUTH_ACCOUNT_DELETED when the token belongs to a deleted user', async () => {
    mockRotateRefreshToken.mockImplementation(() => Promise.resolve({ status: 'account_deleted' }));

    const res = await post('/auth/mobile/refresh', { refreshToken: 'deleted-user-token' });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_ACCOUNT_DELETED');
  });

  it('returns 429 RATE_LIMITED with the documented error shape when rate limited', async () => {
    mockRateLimit.mockImplementation(() =>
      Promise.reject(new ApiError(429, 'Too many requests', 'RATE_LIMITED'))
    );

    const res = await post('/auth/mobile/refresh', { refreshToken: 'mobile-refresh-token' });
    const body = (await res.json()) as { code: string; error: string };

    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.error).toBe('Too many requests');
  });
});

// ---------------------------------------------------------------------------
// POST /auth/mobile/signout
// ---------------------------------------------------------------------------

describe('POST /auth/mobile/signout', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
  });

  it('accepts refreshToken in the request body and returns 204', async () => {
    mockHashToken.mockClear();
    mockRevokeRefreshToken.mockClear();

    const res = await post('/auth/mobile/signout', { refreshToken: 'mobile-refresh-token' });

    expect(res.status).toBe(204);
    expect(mockHashToken).toHaveBeenCalledWith('mobile-refresh-token');
    expect(mockRevokeRefreshToken).toHaveBeenCalledWith('a'.repeat(64));
  });

  it('treats an empty refreshToken as a no-op and returns 204', async () => {
    mockHashToken.mockClear();
    mockRevokeRefreshToken.mockClear();

    const res = await post('/auth/mobile/signout', { refreshToken: '' });

    expect(res.status).toBe(204);
    expect(mockHashToken).not.toHaveBeenCalled();
    expect(mockRevokeRefreshToken).not.toHaveBeenCalled();
  });

  it('returns 204 when refreshToken is omitted entirely', async () => {
    mockHashToken.mockClear();
    mockRevokeRefreshToken.mockClear();

    const res = await post('/auth/mobile/signout', {});

    expect(res.status).toBe(204);
    expect(mockHashToken).not.toHaveBeenCalled();
    expect(mockRevokeRefreshToken).not.toHaveBeenCalled();
  });

  it('returns 429 RATE_LIMITED with the documented error shape when rate limited', async () => {
    mockRateLimit.mockImplementation(() =>
      Promise.reject(new ApiError(429, 'Too many requests', 'RATE_LIMITED'))
    );

    const res = await post('/auth/mobile/signout', { refreshToken: 'mobile-refresh-token' });
    const body = (await res.json()) as { code: string; error: string };

    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.error).toBe('Too many requests');
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
    JSON.stringify({
      sub: userId,
      iss: 'gravity-room-api',
      aud: 'gravity-room-clients',
      exp: Math.floor(Date.now() / 1000) - 3600,
    })
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
// Task 4.4 — sendTelegramMessage called only for new users (REQ-AUTH-004)
// ---------------------------------------------------------------------------

describe('POST /auth/google — Telegram notification (REQ-AUTH-004)', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
    );
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('mock-raw-refresh-token')
    );
    mockSendTelegramMessage.mockClear();
  });

  it('calls sendTelegramMessage once for new users', async () => {
    // Arrange
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: true })
    );

    // Act
    await post('/auth/google', { credential: 'valid-id-token' });

    // Assert
    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(1);
  });

  it('does not call sendTelegramMessage for returning users', async () => {
    // Arrange
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: false })
    );

    // Act
    await post('/auth/google', { credential: 'valid-id-token' });

    // Assert
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task 4.5 — fire-and-forget: auth response returned before notification completes
// ---------------------------------------------------------------------------

describe('POST /auth/google — fire-and-forget timing (REQ-AUTH-004)', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
    );
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('mock-raw-refresh-token')
    );
    mockSendTelegramMessage.mockClear();
  });

  it('returns the auth response before the Telegram notification completes', async () => {
    // Arrange: mock sendTelegramMessage to delay 5 seconds (but returns void, so this is synchronous from caller perspective)
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: true })
    );
    mockSendTelegramMessage.mockImplementation((): void => {
      // Simulate a slow async operation started inside — the route should not await this
      void new Promise<void>((resolve) => setTimeout(resolve, 5_000));
    });

    // Act
    const start = Date.now();
    const res = await post('/auth/google', { credential: 'valid-id-token' });
    const elapsed = Date.now() - start;

    // Assert — response arrives well under 500ms despite the delayed notification
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Task 4.6 — message format: email, deviceType, timestamp (REQ-AUTH-005)
// ---------------------------------------------------------------------------

describe('POST /auth/google — notification message format (REQ-AUTH-005)', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockVerifyGoogleToken.mockImplementation(() =>
      Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
    );
    mockCreateAndStoreRefreshToken.mockImplementation(() =>
      Promise.resolve('mock-raw-refresh-token')
    );
    mockSendTelegramMessage.mockClear();
  });

  it('passes email, deviceType, and timestamp in the notification message for a mobile UA', async () => {
    // Arrange
    const mobileUserAgent =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: true })
    );

    // Act
    await post('/auth/google', { credential: 'valid-id-token' }, { 'User-Agent': mobileUserAgent });

    // Assert
    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(1);
    const [text] = mockSendTelegramMessage.mock.calls[0] as unknown as [string];
    expect(text).toContain('New user: ');
    expect(text).toContain(TEST_USER.email);
    expect(text).toContain('Mobile');
  });

  it('passes Desktop deviceType for a desktop UA', async () => {
    // Arrange
    const desktopUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: true })
    );

    // Act
    await post(
      '/auth/google',
      { credential: 'valid-id-token' },
      { 'User-Agent': desktopUserAgent }
    );

    // Assert
    const [text] = mockSendTelegramMessage.mock.calls[0] as unknown as [string];
    expect(text).toContain('Desktop');
  });

  it('passes Unknown deviceType when User-Agent header is absent', async () => {
    // Arrange
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: true })
    );

    // Act — post() always sends Content-Type; no User-Agent header
    await post('/auth/google', { credential: 'valid-id-token' });

    // Assert
    const [text] = mockSendTelegramMessage.mock.calls[0] as unknown as [string];
    expect(text).toContain('Unknown');
  });

  it('message starts with "New user: " and contains the pipe-separated format', async () => {
    // Arrange
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: true })
    );

    // Act
    await post('/auth/google', { credential: 'valid-id-token' });

    // Assert
    const [text] = mockSendTelegramMessage.mock.calls[0] as unknown as [string];
    expect(text).toMatch(/^New user: .+\|.+\|.+/);
  });
});

describe('POST /auth/signup', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockCreatePasswordUser.mockClear();
    mockCreatePasswordUser.mockImplementation(() => Promise.resolve({ ...PW_USER }));
    mockCreateEmailVerificationToken.mockImplementation(() => Promise.resolve('verify-token'));
    mockSendVerificationEmail.mockClear();
  });

  it('creates an account and returns 201 without tokens', async () => {
    const res = await post('/auth/signup', { email: 'new@example.com', password: 'password123' });
    const body = (await res.json()) as { message: string; accessToken?: string };
    expect(res.status).toBe(201);
    expect(body.message).toContain('verify');
    expect(body.accessToken).toBeUndefined();
    expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a password shorter than 8 chars before touching the service', async () => {
    const res = await post('/auth/signup', { email: 'new@example.com', password: 'short' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockCreatePasswordUser).not.toHaveBeenCalled();
  });

  it('returns 409 EMAIL_TAKEN when the email already exists', async () => {
    mockCreatePasswordUser.mockImplementation(() =>
      Promise.reject(new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN'))
    );
    const res = await post('/auth/signup', {
      email: 'taken@example.com',
      password: 'password123',
    });
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(409);
    expect(body.code).toBe('EMAIL_TAKEN');
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockCreateAndStoreRefreshToken.mockImplementation(() => Promise.resolve('refresh-token'));
  });

  it('returns a generic 401 for invalid credentials', async () => {
    mockAuthenticatePassword.mockImplementation(() => Promise.resolve(null));
    const res = await post('/auth/login', { email: 'a@b.com', password: 'wrong-password' });
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(401);
    expect(body.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 403 EMAIL_NOT_VERIFIED for an unverified account', async () => {
    mockAuthenticatePassword.mockImplementation(() =>
      Promise.resolve({ ...PW_USER, emailVerified: false })
    );
    const res = await post('/auth/login', { email: 'a@b.com', password: 'password123' });
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(403);
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('returns 200 with an access token for a verified user', async () => {
    mockAuthenticatePassword.mockImplementation(() =>
      Promise.resolve({ ...PW_USER, emailVerified: true })
    );
    const res = await post('/auth/login', { email: 'a@b.com', password: 'password123' });
    const body = (await res.json()) as { accessToken: string; user: { email: string } };
    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
    expect(body.user.email).toBe(PW_USER.email);
  });
});

describe('POST /auth/verify-email', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockCreateAndStoreRefreshToken.mockImplementation(() => Promise.resolve('refresh-token'));
  });

  it('returns 400 INVALID_TOKEN for an unknown token', async () => {
    mockConsumeEmailVerificationToken.mockImplementation(() => Promise.resolve(null));
    const res = await post('/auth/verify-email', { token: 'bad-token' });
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_TOKEN');
  });

  it('verifies and auto-logs-in for a valid token', async () => {
    mockConsumeEmailVerificationToken.mockImplementation(() => Promise.resolve(PW_USER.id));
    mockMarkEmailVerified.mockImplementation(() =>
      Promise.resolve({ ...PW_USER, emailVerified: true })
    );
    const res = await post('/auth/verify-email', { token: 'good-token' });
    const body = (await res.json()) as { accessToken: string };
    expect(res.status).toBe(200);
    expect(typeof body.accessToken).toBe('string');
  });
});

describe('POST /auth/forgot-password', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockCreatePasswordResetToken.mockImplementation(() => Promise.resolve('reset-token'));
    mockSendPasswordResetEmail.mockClear();
    mockCreatePasswordResetToken.mockClear();
  });

  it('returns a generic 200 and sends nothing when no account exists', async () => {
    mockFindUserByEmail.mockImplementation(() => Promise.resolve(undefined));
    const res = await post('/auth/forgot-password', { email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends a reset email for a password account, still generic 200', async () => {
    mockFindUserByEmail.mockImplementation(() =>
      Promise.resolve({ ...PW_USER, passwordHash: 'argon2-hash' })
    );
    const res = await post('/auth/forgot-password', { email: PW_USER.email });
    expect(res.status).toBe(200);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('sends nothing for an OAuth-only account (no password hash)', async () => {
    mockFindUserByEmail.mockImplementation(() =>
      Promise.resolve({ ...PW_USER, passwordHash: null })
    );
    const res = await post('/auth/forgot-password', { email: PW_USER.email });
    expect(res.status).toBe(200);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('POST /auth/reset-password', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockSetUserPassword.mockClear();
    mockRevokeAllUserTokens.mockClear();
  });

  it('returns 400 INVALID_TOKEN for an unknown token', async () => {
    mockConsumePasswordResetToken.mockImplementation(() => Promise.resolve(null));
    const res = await post('/auth/reset-password', { token: 'bad', password: 'password123' });
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_TOKEN');
    expect(mockSetUserPassword).not.toHaveBeenCalled();
  });

  it('sets the new password and revokes all sessions for a valid token', async () => {
    mockConsumePasswordResetToken.mockImplementation(() => Promise.resolve(PW_USER.id));
    const res = await post('/auth/reset-password', {
      token: 'good',
      password: 'new-password-123',
    });
    expect(res.status).toBe(200);
    expect(mockSetUserPassword).toHaveBeenCalledTimes(1);
    expect(mockRevokeAllUserTokens).toHaveBeenCalledTimes(1);
  });
});

describe('GET /auth/apple/start', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockIsAppleConfigured.mockImplementation(() => true);
    mockGenerateRefreshToken.mockImplementation(() => 'state-fixed-123');
  });

  it('redirects to Apple and sets a state cookie when configured', async () => {
    const res = await get('/auth/apple/start');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('appleid.apple.com/auth/authorize');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_state='))).toBe(true);
  });

  it('redirects to the SPA callback with an error when not configured', async () => {
    mockIsAppleConfigured.mockImplementation(() => false);
    const res = await get('/auth/apple/start');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain(
      '/auth/callback?provider=apple&error=provider_not_configured'
    );
  });
});

describe('POST /auth/apple/callback', () => {
  beforeEach(() => {
    mockCreateAndStoreRefreshToken.mockImplementation(() => Promise.resolve('refresh-token'));
    mockVerifyAppleIdToken.mockImplementation(() =>
      Promise.resolve({
        sub: 'apple-sub',
        email: 'apple@example.com',
        emailVerified: true,
        name: 'Ada',
      })
    );
    mockFindOrCreateUserByIdentity.mockImplementation(() =>
      Promise.resolve({ user: { ...PW_USER, email: 'apple@example.com' }, isNewUser: false })
    );
  });

  it('redirects with state_mismatch when no state cookie is present', async () => {
    const res = await post('/auth/apple/callback', { id_token: 'tok', state: 'abc' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
  });

  it('redirects with cancelled when Apple returns an error field', async () => {
    const res = await post(
      '/auth/apple/callback',
      { error: 'user_cancelled_authorize' },
      { Cookie: 'oauth_state=abc' }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=cancelled');
  });

  it('verifies the token, sets the refresh cookie, and redirects on success', async () => {
    const res = await post(
      '/auth/apple/callback',
      { id_token: 'tok', state: 'abc' },
      { Cookie: 'oauth_state=abc' }
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/auth/callback?provider=apple');
    expect(loc).not.toContain('error=');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('refresh_token='))).toBe(true);
  });
});

describe('GET /auth/github/start', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockIsGitHubConfigured.mockImplementation(() => true);
    mockGenerateRefreshToken.mockImplementation(() => 'state-fixed-123');
  });

  it('redirects to GitHub and sets a state cookie when configured', async () => {
    const res = await get('/auth/github/start');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('github.com/login/oauth/authorize');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_state='))).toBe(true);
  });

  it('redirects to the SPA callback with an error when not configured', async () => {
    mockIsGitHubConfigured.mockImplementation(() => false);
    const res = await get('/auth/github/start');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain(
      '/auth/callback?provider=github&error=provider_not_configured'
    );
  });
});

describe('GET /auth/github/callback', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockCreateAndStoreRefreshToken.mockImplementation(() => Promise.resolve('refresh-token'));
    mockExchangeGitHubCode.mockImplementation(() => Promise.resolve('gho_token'));
    mockFetchGitHubIdentity.mockImplementation(() =>
      Promise.resolve({
        id: 'gh-123',
        email: 'octo@example.com',
        emailVerified: true,
        name: 'Octo',
      })
    );
    mockFindOrCreateUserByIdentity.mockImplementation(() =>
      Promise.resolve({ user: { ...PW_USER, email: 'octo@example.com' }, isNewUser: false })
    );
  });

  it('redirects with state_mismatch when no state cookie is present', async () => {
    const res = await get('/auth/github/callback?code=abc&state=xyz');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
  });

  it('redirects with cancelled when GitHub returns an error', async () => {
    const res = await get('/auth/github/callback?error=access_denied', {
      Cookie: 'oauth_state=xyz',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=cancelled');
  });

  it('exchanges the code, sets the refresh cookie, and redirects on success', async () => {
    const res = await get('/auth/github/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz',
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/auth/callback?provider=github');
    expect(loc).not.toContain('error=');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('redirects with email_required when the GitHub account has no verified email', async () => {
    mockFetchGitHubIdentity.mockImplementation(() =>
      Promise.reject(new ApiError(401, 'No verified email', 'AUTH_EMAIL_UNVERIFIED'))
    );
    const res = await get('/auth/github/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=email_required');
  });
});
