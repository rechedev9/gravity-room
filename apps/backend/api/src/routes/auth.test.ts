/**
 * Auth routes integration tests — uses Elysia's .handle() method, no real server.
 * DB-dependent services and the Google token verifier are mocked via vi.mock().
 */
process.env['LOG_LEVEL'] = 'silent';
process.env['GOOGLE_CLIENT_ID'] = 'web-client-id';
process.env['GOOGLE_CLIENT_IDS'] = 'mobile-client-id';

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

afterAll(() => {
  vi.restoreAllMocks();
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

const {
  mockHashToken,
  mockFindUserById,
  mockFindRefreshToken,
  mockRevokeRefreshToken,
  mockRevokeAllUserTokens,
  mockFindRefreshTokenByPreviousHash,
  mockCreateAndStoreRefreshToken,
  mockRotateRefreshToken,
  mockFindOrCreateGoogleUser,
  mockFindUserByEmail,
  mockAuthenticatePassword,
  mockCreatePasswordUser,
  mockCreateEmailVerificationToken,
  mockConsumeEmailVerificationToken,
  mockMarkEmailVerified,
  mockCreatePasswordResetToken,
  mockConsumePasswordResetToken,
  mockSetUserPassword,
  mockFindOrCreateUserByIdentity,
  mockGenerateRefreshToken,
  mockUpdateUserProfile,
  mockSendVerificationEmail,
  mockSendPasswordResetEmail,
  mockIsEmailConfigured,
  mockIsAppleConfigured,
  mockBuildAppleAuthorizeUrl,
  mockVerifyAppleIdToken,
  mockParseAppleUserName,
  mockIsGitHubConfigured,
  mockBuildGitHubAuthorizeUrl,
  mockExchangeGitHubCode,
  mockGeneratePkceVerifier,
  mockPkceChallenge,
  mockFetchGitHubIdentity,
  mockIsMicrosoftConfigured,
  mockBuildMicrosoftAuthorizeUrl,
  mockExchangeMicrosoftCode,
  mockFetchMicrosoftIdentity,
  mockVerifyGoogleToken,
  mockRateLimit,
  mockSendTelegramMessage,
} = vi.hoisted(() => {
  const mockHashToken = vi.fn(() => Promise.resolve('a'.repeat(64)));
  const mockFindUserById = vi.fn<() => Promise<typeof TEST_USER | undefined>>(() =>
    Promise.resolve({ ...TEST_USER })
  );
  const mockFindRefreshToken = vi.fn<() => Promise<typeof TEST_REFRESH_TOKEN | undefined>>(() =>
    Promise.resolve(undefined)
  );
  const mockRevokeRefreshToken = vi.fn(() => Promise.resolve());
  const mockRevokeAllUserTokens = vi.fn(() => Promise.resolve());
  const mockFindRefreshTokenByPreviousHash = vi.fn<
    () => Promise<typeof TEST_REFRESH_TOKEN | undefined>
  >(() => Promise.resolve(undefined));
  const mockCreateAndStoreRefreshToken = vi.fn(() => Promise.resolve('mock-raw-refresh-token'));
  const mockRotateRefreshToken = vi.fn<() => Promise<MockRotateRefreshTokenResult>>(() =>
    Promise.resolve({
      status: 'rotated' as const,
      user: { ...TEST_USER },
      refreshToken: 'new-raw-refresh-token',
    })
  );
  const mockFindOrCreateGoogleUser = vi.fn<
    () => Promise<{ user: typeof TEST_USER; isNewUser: boolean }>
  >(() => Promise.resolve({ user: { ...TEST_USER }, isNewUser: false }));
  const mockFindUserByEmail = vi.fn<() => Promise<MockUserRow | undefined>>(() =>
    Promise.resolve(undefined)
  );
  const mockAuthenticatePassword = vi.fn<() => Promise<MockUserRow | null>>(() =>
    Promise.resolve(null)
  );
  const mockCreatePasswordUser = vi.fn<() => Promise<MockUserRow>>(() =>
    Promise.resolve({ ...PW_USER })
  );
  const mockCreateEmailVerificationToken = vi.fn(() => Promise.resolve('verify-token'));
  const mockConsumeEmailVerificationToken = vi.fn<() => Promise<string | null>>(() =>
    Promise.resolve(null)
  );
  const mockMarkEmailVerified = vi.fn<() => Promise<MockUserRow | undefined>>(() =>
    Promise.resolve({ ...PW_USER })
  );
  const mockCreatePasswordResetToken = vi.fn(() => Promise.resolve('reset-token'));
  const mockConsumePasswordResetToken = vi.fn<() => Promise<string | null>>(() =>
    Promise.resolve(null)
  );
  const mockSetUserPassword = vi.fn(() => Promise.resolve());
  const mockFindOrCreateUserByIdentity = vi.fn<
    () => Promise<{ user: MockUserRow; isNewUser: boolean }>
  >(() => Promise.resolve({ user: { ...PW_USER }, isNewUser: false }));
  const mockGenerateRefreshToken = vi.fn(() => 'state-fixed-123');
  const mockUpdateUserProfile = vi.fn(() =>
    Promise.resolve({ ...PW_USER, name: 'Updated User', avatarUrl: null })
  );
  const mockSendVerificationEmail = vi.fn(() => Promise.resolve());
  const mockSendPasswordResetEmail = vi.fn(() => Promise.resolve());
  const mockIsEmailConfigured = vi.fn(() => true);
  const mockIsAppleConfigured = vi.fn(() => true);
  const mockBuildAppleAuthorizeUrl = vi.fn(
    () => 'https://appleid.apple.com/auth/authorize?client_id=x&state=state-fixed-123'
  );
  const mockVerifyAppleIdToken = vi.fn<
    (
      idToken: string,
      expectedNonce?: string
    ) => Promise<{
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
  const mockParseAppleUserName = vi.fn<() => string | undefined>(() => undefined);
  const mockIsGitHubConfigured = vi.fn(() => true);
  const mockBuildGitHubAuthorizeUrl = vi.fn(
    () => 'https://github.com/login/oauth/authorize?client_id=x&state=state-fixed-123'
  );
  const mockExchangeGitHubCode = vi.fn(() => Promise.resolve('gho_token'));
  const mockGeneratePkceVerifier = vi.fn(() => 'github-pkce-verifier');
  const mockPkceChallenge = vi.fn(() => Promise.resolve('github-pkce-challenge'));
  const mockFetchGitHubIdentity = vi.fn<
    () => Promise<{ id: string; email: string; emailVerified: boolean; name: string | undefined }>
  >(() =>
    Promise.resolve({ id: 'gh-123', email: 'octo@example.com', emailVerified: true, name: 'Octo' })
  );
  const mockIsMicrosoftConfigured = vi.fn(() => true);
  const mockBuildMicrosoftAuthorizeUrl = vi.fn(
    () => 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=x'
  );
  const mockExchangeMicrosoftCode = vi.fn(() =>
    Promise.resolve({ idToken: 'ms-id-token', accessToken: 'ms-access-token' })
  );
  const mockFetchMicrosoftIdentity = vi.fn<
    () => Promise<{ id: string; email: string; emailVerified: boolean; name: string | undefined }>
  >(() =>
    Promise.resolve({
      id: 'ms-123',
      email: 'microsoft@example.com',
      emailVerified: true,
      name: 'Morgan',
    })
  );
  const mockVerifyGoogleToken = vi.fn(() =>
    Promise.resolve({ sub: 'google-uid-123', email: 'test@example.com', name: 'Test User' })
  );
  const mockRateLimit = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const mockSendTelegramMessage = vi.fn((): Promise<void> => Promise.resolve());
  return {
    mockHashToken,
    mockFindUserById,
    mockFindRefreshToken,
    mockRevokeRefreshToken,
    mockRevokeAllUserTokens,
    mockFindRefreshTokenByPreviousHash,
    mockCreateAndStoreRefreshToken,
    mockRotateRefreshToken,
    mockFindOrCreateGoogleUser,
    mockFindUserByEmail,
    mockAuthenticatePassword,
    mockCreatePasswordUser,
    mockCreateEmailVerificationToken,
    mockConsumeEmailVerificationToken,
    mockMarkEmailVerified,
    mockCreatePasswordResetToken,
    mockConsumePasswordResetToken,
    mockSetUserPassword,
    mockFindOrCreateUserByIdentity,
    mockGenerateRefreshToken,
    mockUpdateUserProfile,
    mockSendVerificationEmail,
    mockSendPasswordResetEmail,
    mockIsEmailConfigured,
    mockIsAppleConfigured,
    mockBuildAppleAuthorizeUrl,
    mockVerifyAppleIdToken,
    mockParseAppleUserName,
    mockIsGitHubConfigured,
    mockBuildGitHubAuthorizeUrl,
    mockExchangeGitHubCode,
    mockGeneratePkceVerifier,
    mockPkceChallenge,
    mockFetchGitHubIdentity,
    mockIsMicrosoftConfigured,
    mockBuildMicrosoftAuthorizeUrl,
    mockExchangeMicrosoftCode,
    mockFetchMicrosoftIdentity,
    mockVerifyGoogleToken,
    mockRateLimit,
    mockSendTelegramMessage,
  };
});

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

const OVERSIZED_EMAIL = `${'a'.repeat(250)}@e.co`;

// hashPassword is intentionally NOT mocked — it is a pure @node-rs/argon2 call that
// needs no DB, and mocking it here leaks into the service unit tests (Bun's
// mock.module is process-global). Letting it run real keeps both suites correct.

// Partial mock: spread the real module so non-DB pure helpers (notably
// hashPassword, which runs argon2 with no DB) keep their real implementation,
// then override every DB-backed export with a stub. Under bun's mock.module
// unlisted exports were merged from the real module; vitest needs this explicit.
vi.mock('../services/auth', async () => ({
  ...(await vi.importActual<typeof import('../services/auth')>('../services/auth')),
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
  updateUserProfile: mockUpdateUserProfile,
  authenticatePassword: mockAuthenticatePassword,
  createPasswordUser: mockCreatePasswordUser,
  createEmailVerificationToken: mockCreateEmailVerificationToken,
  consumeEmailVerificationToken: mockConsumeEmailVerificationToken,
  markEmailVerified: mockMarkEmailVerified,
  createPasswordResetToken: mockCreatePasswordResetToken,
  consumePasswordResetToken: mockConsumePasswordResetToken,
  setUserPassword: mockSetUserPassword,
  // Included so the process-global services/auth mock exposes every export the
  // routes batch consumes (internal.ts imports cleanupExpiredTokens). Keeps the
  // frozen export-name set complete regardless of sibling test ordering.
  cleanupExpiredTokens: vi.fn(() => Promise.resolve(0)),
  REFRESH_TOKEN_DAYS: 7,
}));

vi.mock('../lib/email', () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  isEmailConfigured: mockIsEmailConfigured,
}));

vi.mock('../lib/apple-auth', () => ({
  isAppleConfigured: mockIsAppleConfigured,
  buildAppleAuthorizeUrl: mockBuildAppleAuthorizeUrl,
  verifyAppleIdToken: mockVerifyAppleIdToken,
  parseAppleUserName: mockParseAppleUserName,
}));

vi.mock('../lib/github-auth', () => ({
  isGitHubConfigured: mockIsGitHubConfigured,
  buildGitHubAuthorizeUrl: mockBuildGitHubAuthorizeUrl,
  exchangeGitHubCode: mockExchangeGitHubCode,
  generatePkceVerifier: mockGeneratePkceVerifier,
  pkceChallenge: mockPkceChallenge,
  fetchGitHubIdentity: mockFetchGitHubIdentity,
}));

vi.mock('../lib/microsoft-auth', () => ({
  isMicrosoftConfigured: mockIsMicrosoftConfigured,
  buildMicrosoftAuthorizeUrl: mockBuildMicrosoftAuthorizeUrl,
  exchangeMicrosoftCode: mockExchangeMicrosoftCode,
  fetchMicrosoftIdentity: mockFetchMicrosoftIdentity,
}));

// Partial mock: keep the real getWebGoogleClientId / getMobileGoogleClientIds
// (which read process.env and throw CONFIGURATION_ERROR when unset) and only
// override verifyGoogleToken. Under bun's mock.module unlisted exports were
// merged from the real module; vitest requires this to be explicit.
vi.mock('../lib/google-auth', async () => ({
  ...(await vi.importActual<typeof import('../lib/google-auth')>('../lib/google-auth')),
  verifyGoogleToken: mockVerifyGoogleToken,
}));

vi.mock('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('../lib/telegram', () => ({
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

function patch(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request(`http://localhost${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

async function makeValidJwt(userId: string): Promise<string> {
  // Must match the fallback auth-guard uses when JWT_SECRET is unset
  // (TEST_SECRET), or the signature won't verify and the token 401s.
  const secret = process.env['JWT_SECRET'] ?? 'test-secret-do-not-use-outside-tests';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iss: 'gravity-room-api',
      aud: 'gravity-room-clients',
      exp: Math.floor(Date.now() / 1000) + 3600,
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
  return `${signingInput}.${Buffer.from(sig).toString('base64url')}`;
}

// ---------------------------------------------------------------------------
// GET /auth/providers
// ---------------------------------------------------------------------------

describe('GET /auth/providers', () => {
  beforeEach(() => {
    process.env['GOOGLE_CLIENT_ID'] = 'web-client-id';
    mockRateLimit.mockClear();
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockIsEmailConfigured.mockClear();
    mockIsAppleConfigured.mockClear();
    mockIsGitHubConfigured.mockClear();
    mockIsMicrosoftConfigured.mockClear();
    mockIsEmailConfigured.mockImplementation(() => true);
    mockIsAppleConfigured.mockImplementation(() => true);
    mockIsGitHubConfigured.mockImplementation(() => true);
    mockIsMicrosoftConfigured.mockImplementation(() => true);
  });

  it('returns which sign-in methods are currently available', async () => {
    const res = await get('/auth/providers');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      emailPassword: true,
      google: true,
      apple: true,
      github: true,
      microsoft: true,
    });
  });

  it('rate-limits provider availability requests before reading provider config', async () => {
    mockRateLimit.mockImplementation(() =>
      Promise.reject(new ApiError(429, 'Too many requests', 'RATE_LIMITED'))
    );

    const res = await get('/auth/providers');
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(mockIsEmailConfigured).not.toHaveBeenCalled();
    expect(mockIsAppleConfigured).not.toHaveBeenCalled();
    expect(mockIsGitHubConfigured).not.toHaveBeenCalled();
    expect(mockIsMicrosoftConfigured).not.toHaveBeenCalled();
  });

  it('marks production email/password unavailable when email delivery is unconfigured', async () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    try {
      process.env['NODE_ENV'] = 'production';
      mockIsEmailConfigured.mockImplementation(() => false);
      mockIsAppleConfigured.mockImplementation(() => false);
      mockIsGitHubConfigured.mockImplementation(() => false);
      mockIsMicrosoftConfigured.mockImplementation(() => false);
      process.env['GOOGLE_CLIENT_ID'] = '';

      const res = await get('/auth/providers');

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        emailPassword: false,
        google: false,
        apple: false,
        github: false,
        microsoft: false,
      });
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
      process.env['GOOGLE_CLIENT_ID'] = 'web-client-id';
    }
  });
});

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

  it('rejects oversized credentials before verifying the Google token', async () => {
    const res = await post('/auth/google', { credential: 'x'.repeat(12_001) });

    expect(res.status).toBe(400);
    expect(mockVerifyGoogleToken).not.toHaveBeenCalled();
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
    mockVerifyGoogleToken.mockClear();
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

  it('rejects oversized credentials before verifying the mobile Google token', async () => {
    const res = await post('/auth/mobile/google', { credential: 'x'.repeat(12_001) });

    expect(res.status).toBe(400);
    expect(mockVerifyGoogleToken).not.toHaveBeenCalled();
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

  it('rejects oversized refresh cookies before rotation lookup', async () => {
    mockRotateRefreshToken.mockClear();

    const res = await post('/auth/refresh', {}, { Cookie: `refresh_token=${'x'.repeat(257)}` });
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe('AUTH_INVALID_REFRESH');
    expect(mockRotateRefreshToken).not.toHaveBeenCalled();
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

  it('rejects oversized refreshToken values before hashing', async () => {
    mockHashToken.mockClear();
    mockRotateRefreshToken.mockClear();

    const res = await post('/auth/mobile/refresh', { refreshToken: 'x'.repeat(257) });

    expect(res.status).toBe(400);
    expect(mockHashToken).not.toHaveBeenCalled();
    expect(mockRotateRefreshToken).not.toHaveBeenCalled();
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

  it('rejects oversized refreshToken values before hashing', async () => {
    mockHashToken.mockClear();
    mockRevokeRefreshToken.mockClear();

    const res = await post('/auth/mobile/signout', { refreshToken: 'x'.repeat(257) });

    expect(res.status).toBe(400);
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
// POST /auth/signout (web, cookie-based)
// ---------------------------------------------------------------------------

describe('POST /auth/signout', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
  });

  it('returns a body-less 204 and clears the refresh cookie at /api/auth', async () => {
    const res = await post('/auth/signout', {}, { Cookie: 'refresh_token=some-token-value' });

    expect(res.status).toBe(204);
    // 204 must carry no body: Node's undici rejects a non-null body with 204.
    expect(await res.text()).toBe('');

    // The cookie clear set via the Elysia cookie proxy must still be serialized
    // onto the explicit `new Response(null, { status: 204 })` we return.
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('refresh_token=');
    expect(setCookie).toContain('Path=/api/auth');
    expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=/);
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
  // Match the secret auth-guard captured at import time (its TEST_SECRET fallback
  // when JWT_SECRET is unset) so the token fails on expiry, not on a bad signature.
  const secret = process.env['JWT_SECRET'] ?? 'test-secret-do-not-use-outside-tests';
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
// PATCH /auth/me
// ---------------------------------------------------------------------------

describe('PATCH /auth/me', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockRateLimit.mockClear();
    mockUpdateUserProfile.mockClear();
    mockFindUserById.mockImplementation(() => Promise.resolve({ ...TEST_USER }));
  });

  it('rejects oversized avatar data URLs before rate limiting', async () => {
    const token = await makeValidJwt('user-123');
    const oversizedAvatar = `data:image/png;base64,${'A'.repeat(200_004)}`;

    const res = await patch(
      '/auth/me',
      { avatarUrl: oversizedAvatar },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it('rejects well-formed base64 that is not a real image of the declared type', async () => {
    const token = await makeValidJwt('user-123');
    // Valid base64 ("hello world") but no PNG signature.
    const fakeImage = `data:image/png;base64,${Buffer.from('hello world').toString('base64')}`;

    const res = await patch(
      '/auth/me',
      { avatarUrl: fakeImage },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(400);
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it('accepts a base64 data URL whose bytes carry the declared image signature', async () => {
    const token = await makeValidJwt('user-123');
    // 1x1 transparent PNG — real 89 50 4E 47 signature.
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const realPng = `data:image/png;base64,${pngBase64}`;

    const res = await patch(
      '/auth/me',
      { avatarUrl: realPng },
      { Authorization: `Bearer ${token}` }
    );

    expect(res.status).toBe(200);
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ avatarUrl: realPng })
    );
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
    // Arrange: mock sendTelegramMessage to return a slow promise. Off Vercel,
    // keepAlive does not await it, so the route still responds immediately.
    mockFindOrCreateGoogleUser.mockImplementation(() =>
      Promise.resolve({ user: { ...TEST_USER }, isNewUser: true })
    );
    mockSendTelegramMessage.mockImplementation(
      (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 5_000))
    );

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
    mockIsEmailConfigured.mockImplementation(() => true);
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

  it('rejects oversized email addresses before creating a password user', async () => {
    const res = await post('/auth/signup', {
      email: OVERSIZED_EMAIL,
      password: 'password123',
    });

    expect(res.status).toBe(400);
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

  it('fails closed in production when transactional email is not configured', async () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    mockIsEmailConfigured.mockImplementation(() => false);

    try {
      const res = await post('/auth/signup', {
        email: 'new@example.com',
        password: 'password123',
      });
      const body = (await res.json()) as { code: string };
      expect(res.status).toBe(503);
      expect(body.code).toBe('EMAIL_NOT_CONFIGURED');
      expect(mockCreatePasswordUser).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
    }
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockCreateAndStoreRefreshToken.mockImplementation(() => Promise.resolve('refresh-token'));
    mockAuthenticatePassword.mockClear();
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

  it('rejects oversized email addresses before authenticating credentials', async () => {
    const res = await post('/auth/login', {
      email: OVERSIZED_EMAIL,
      password: 'password123',
    });

    expect(res.status).toBe(400);
    expect(mockAuthenticatePassword).not.toHaveBeenCalled();
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

  it('rejects oversized verification tokens before consuming them', async () => {
    mockConsumeEmailVerificationToken.mockClear();

    const res = await post('/auth/verify-email', { token: 'x'.repeat(257) });

    expect(res.status).toBe(400);
    expect(mockConsumeEmailVerificationToken).not.toHaveBeenCalled();
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
    mockFindUserByEmail.mockClear();
    mockIsEmailConfigured.mockImplementation(() => true);
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

  it('rejects oversized email addresses before looking up accounts', async () => {
    const res = await post('/auth/forgot-password', { email: OVERSIZED_EMAIL });

    expect(res.status).toBe(400);
    expect(mockFindUserByEmail).not.toHaveBeenCalled();
    expect(mockCreatePasswordResetToken).not.toHaveBeenCalled();
  });

  it('fails closed in production when transactional email is not configured', async () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    mockIsEmailConfigured.mockImplementation(() => false);

    try {
      const res = await post('/auth/forgot-password', { email: PW_USER.email });
      const body = (await res.json()) as { code: string };
      expect(res.status).toBe(503);
      expect(body.code).toBe('EMAIL_NOT_CONFIGURED');
      expect(mockFindUserByEmail).not.toHaveBeenCalled();
      expect(mockCreatePasswordResetToken).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
    }
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

  it('rejects oversized reset tokens before consuming them', async () => {
    mockConsumePasswordResetToken.mockClear();

    const res = await post('/auth/reset-password', {
      token: 'x'.repeat(257),
      password: 'new-password-123',
    });

    expect(res.status).toBe(400);
    expect(mockConsumePasswordResetToken).not.toHaveBeenCalled();
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

  it('redirects to Apple and sets state and nonce cookies when configured', async () => {
    const res = await get('/auth/apple/start');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('appleid.apple.com/auth/authorize');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_state='))).toBe(true);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_nonce='))).toBe(true);
    expect(mockBuildAppleAuthorizeUrl).toHaveBeenCalledWith(
      'state-fixed-123',
      'http://localhost:3001/api/auth/apple/callback',
      'state-fixed-123'
    );
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
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockCreateAndStoreRefreshToken.mockImplementation(() => Promise.resolve('refresh-token'));
    mockVerifyAppleIdToken.mockClear();
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

  it('rate-limits callback attempts before processing provider input', async () => {
    mockRateLimit.mockImplementation(() =>
      Promise.reject(new ApiError(429, 'Too many requests', 'RATE_LIMITED'))
    );

    const res = await post(
      '/auth/apple/callback',
      { id_token: 'tok', state: 'abc' },
      { Cookie: 'oauth_state=abc; oauth_nonce=nonce-1' }
    );
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(mockVerifyAppleIdToken).not.toHaveBeenCalled();
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
      { Cookie: 'oauth_state=abc; oauth_nonce=nonce-1' }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=cancelled');
  });

  it('redirects with state_mismatch when no nonce cookie is present', async () => {
    const res = await post(
      '/auth/apple/callback',
      { id_token: 'tok', state: 'abc' },
      { Cookie: 'oauth_state=abc' }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
    expect(mockVerifyAppleIdToken).not.toHaveBeenCalled();
  });

  it('rejects oversized callback fields before verifying the Apple token', async () => {
    mockVerifyAppleIdToken.mockClear();

    const res = await post(
      '/auth/apple/callback',
      { id_token: 'x'.repeat(12_001), state: 'abc' },
      { Cookie: 'oauth_state=abc; oauth_nonce=nonce-1' }
    );

    expect(res.status).toBe(400);
    expect(mockVerifyAppleIdToken).not.toHaveBeenCalled();
  });

  it('verifies the token, sets the refresh cookie, and redirects on success', async () => {
    const res = await post(
      '/auth/apple/callback',
      { id_token: 'tok', state: 'abc' },
      { Cookie: 'oauth_state=abc; oauth_nonce=nonce-1' }
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/auth/callback?provider=apple');
    expect(loc).not.toContain('error=');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(mockVerifyAppleIdToken).toHaveBeenCalledWith('tok', 'nonce-1');
  });
});

describe('GET /auth/github/start', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockIsGitHubConfigured.mockImplementation(() => true);
    mockGenerateRefreshToken.mockImplementation(() => 'state-fixed-123');
    mockGeneratePkceVerifier.mockImplementation(() => 'github-pkce-verifier');
    mockPkceChallenge.mockImplementation(() => Promise.resolve('github-pkce-challenge'));
  });

  it('redirects to GitHub and sets state and PKCE cookies when configured', async () => {
    const res = await get('/auth/github/start');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('github.com/login/oauth/authorize');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_state='))).toBe(true);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_pkce='))).toBe(true);
    expect(mockBuildGitHubAuthorizeUrl).toHaveBeenCalledWith(
      'state-fixed-123',
      'http://localhost:3001/api/auth/github/callback',
      'github-pkce-challenge'
    );
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

  it('rate-limits callback attempts before exchanging the provider code', async () => {
    mockRateLimit.mockImplementation(() =>
      Promise.reject(new ApiError(429, 'Too many requests', 'RATE_LIMITED'))
    );

    const res = await get('/auth/github/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz; oauth_pkce=verifier-1',
    });
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(mockExchangeGitHubCode).not.toHaveBeenCalled();
  });

  it('redirects with state_mismatch when no state cookie is present', async () => {
    const res = await get('/auth/github/callback?code=abc&state=xyz');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
  });

  it('redirects with cancelled when GitHub returns an error', async () => {
    const res = await get('/auth/github/callback?error=access_denied', {
      Cookie: 'oauth_state=xyz; oauth_pkce=verifier-1',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=cancelled');
  });

  it('redirects with state_mismatch when no PKCE verifier cookie is present', async () => {
    const res = await get('/auth/github/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
    expect(mockExchangeGitHubCode).not.toHaveBeenCalled();
  });

  it('rejects oversized callback query before exchanging the GitHub code', async () => {
    mockExchangeGitHubCode.mockClear();

    const code = encodeURIComponent('x'.repeat(4097));
    const res = await get(`/auth/github/callback?code=${code}&state=xyz`, {
      Cookie: 'oauth_state=xyz; oauth_pkce=verifier-1',
    });

    expect(res.status).toBe(400);
    expect(mockExchangeGitHubCode).not.toHaveBeenCalled();
  });

  it('exchanges the code, sets the refresh cookie, and redirects on success', async () => {
    const res = await get('/auth/github/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz; oauth_pkce=verifier-1',
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/auth/callback?provider=github');
    expect(loc).not.toContain('error=');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(mockExchangeGitHubCode).toHaveBeenCalledWith(
      'abc',
      'http://localhost:3001/api/auth/github/callback',
      'verifier-1'
    );
  });

  it('redirects with email_required when the GitHub account has no verified email', async () => {
    mockFetchGitHubIdentity.mockImplementation(() =>
      Promise.reject(new ApiError(401, 'No verified email', 'AUTH_EMAIL_UNVERIFIED'))
    );
    const res = await get('/auth/github/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz; oauth_pkce=verifier-1',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=email_required');
  });
});

describe('GET /auth/microsoft/start', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockIsMicrosoftConfigured.mockImplementation(() => true);
    mockGenerateRefreshToken.mockImplementation(() => 'state-fixed-123');
    mockGeneratePkceVerifier.mockImplementation(() => 'microsoft-pkce-verifier');
    mockPkceChallenge.mockImplementation(() => Promise.resolve('microsoft-pkce-challenge'));
  });

  it('redirects to Microsoft and sets state, nonce, and PKCE cookies when configured', async () => {
    const res = await get('/auth/microsoft/start');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('login.microsoftonline.com');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_state='))).toBe(true);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_nonce='))).toBe(true);
    expect(res.headers.getSetCookie().some((c) => c.startsWith('oauth_pkce='))).toBe(true);
    expect(mockBuildMicrosoftAuthorizeUrl).toHaveBeenCalledWith(
      'state-fixed-123',
      'http://localhost:3001/api/auth/microsoft/callback',
      'state-fixed-123',
      'microsoft-pkce-challenge'
    );
  });

  it('redirects to the SPA callback with an error when not configured', async () => {
    mockIsMicrosoftConfigured.mockImplementation(() => false);
    const res = await get('/auth/microsoft/start');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain(
      '/auth/callback?provider=microsoft&error=provider_not_configured'
    );
  });
});

describe('GET /auth/microsoft/callback', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockCreateAndStoreRefreshToken.mockImplementation(() => Promise.resolve('refresh-token'));
    mockExchangeMicrosoftCode.mockClear();
    mockFetchMicrosoftIdentity.mockClear();
    mockExchangeMicrosoftCode.mockImplementation(() =>
      Promise.resolve({ idToken: 'ms-id-token', accessToken: 'ms-access-token' })
    );
    mockFetchMicrosoftIdentity.mockImplementation(() =>
      Promise.resolve({
        id: 'ms-123',
        email: 'microsoft@example.com',
        emailVerified: true,
        name: 'Morgan',
      })
    );
    mockFindOrCreateUserByIdentity.mockImplementation(() =>
      Promise.resolve({ user: { ...PW_USER, email: 'microsoft@example.com' }, isNewUser: false })
    );
  });

  it('rate-limits callback attempts before exchanging the provider code', async () => {
    mockRateLimit.mockImplementation(() =>
      Promise.reject(new ApiError(429, 'Too many requests', 'RATE_LIMITED'))
    );

    const res = await get('/auth/microsoft/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz; oauth_nonce=nonce-1; oauth_pkce=verifier-1',
    });
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(mockExchangeMicrosoftCode).not.toHaveBeenCalled();
  });

  it('redirects with state_mismatch when no state cookie is present', async () => {
    const res = await get('/auth/microsoft/callback?code=abc&state=xyz');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
  });

  it('redirects with cancelled when Microsoft returns an error', async () => {
    const res = await get('/auth/microsoft/callback?error=access_denied', {
      Cookie: 'oauth_state=xyz; oauth_nonce=nonce-1; oauth_pkce=verifier-1',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=cancelled');
  });

  it('redirects with state_mismatch when nonce or PKCE cookies are missing', async () => {
    const res = await get('/auth/microsoft/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
    expect(mockExchangeMicrosoftCode).not.toHaveBeenCalled();
  });

  it('rejects oversized callback query before exchanging the Microsoft code', async () => {
    mockExchangeMicrosoftCode.mockClear();

    const code = encodeURIComponent('x'.repeat(4097));
    const res = await get(`/auth/microsoft/callback?code=${code}&state=xyz`, {
      Cookie: 'oauth_state=xyz; oauth_nonce=nonce-1; oauth_pkce=verifier-1',
    });

    expect(res.status).toBe(400);
    expect(mockExchangeMicrosoftCode).not.toHaveBeenCalled();
  });

  it('exchanges the code, sets the refresh cookie, and redirects on success', async () => {
    const res = await get('/auth/microsoft/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz; oauth_nonce=nonce-1; oauth_pkce=verifier-1',
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/auth/callback?provider=microsoft');
    expect(loc).not.toContain('error=');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(mockExchangeMicrosoftCode).toHaveBeenCalledWith(
      'abc',
      'http://localhost:3001/api/auth/microsoft/callback',
      'verifier-1'
    );
    expect(mockFetchMicrosoftIdentity).toHaveBeenCalledWith(
      'ms-id-token',
      'ms-access-token',
      'nonce-1'
    );
  });

  it('redirects with email_required when the Microsoft account has no usable email', async () => {
    mockFetchMicrosoftIdentity.mockImplementation(() =>
      Promise.reject(new ApiError(401, 'No email', 'AUTH_EMAIL_UNVERIFIED'))
    );
    const res = await get('/auth/microsoft/callback?code=abc&state=xyz', {
      Cookie: 'oauth_state=xyz; oauth_nonce=nonce-1; oauth_pkce=verifier-1',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=email_required');
  });
});
