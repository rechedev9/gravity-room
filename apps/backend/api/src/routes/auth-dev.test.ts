process.env['LOG_LEVEL'] = 'silent';
process.env['NODE_ENV'] = 'test';
process.env['AUTH_DEV_ROUTE_ENABLED'] = 'true';
process.env['AUTH_DEV_ROUTE_SECRET'] = 'test-dev-auth-secret';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';

afterAll(() => {
  vi.restoreAllMocks();
});

const PW_USER = {
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

const mockRateLimit = vi.fn<() => Promise<void>>(() => Promise.resolve());
vi.mock('../middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

const mockFindUserByEmail = vi.fn<() => Promise<typeof PW_USER | undefined>>(() =>
  Promise.resolve(undefined)
);
const mockCreatePasswordUser = vi.fn<() => Promise<typeof PW_USER>>(() =>
  Promise.resolve({ ...PW_USER, emailVerified: false })
);
const mockSetUserPassword = vi.fn(() => Promise.resolve());
const mockMarkEmailVerified = vi.fn<() => Promise<typeof PW_USER | undefined>>(() =>
  Promise.resolve({ ...PW_USER })
);
const mockHashPassword = vi.fn(() => Promise.resolve('hashed-password'));

vi.mock('../services/auth', () => ({
  hashToken: vi.fn(() => Promise.resolve('a'.repeat(64))),
  findUserById: vi.fn(() => Promise.resolve({ ...PW_USER })),
  findRefreshTokenByPreviousHash: vi.fn(() => Promise.resolve(undefined)),
  revokeRefreshToken: vi.fn(() => Promise.resolve()),
  revokeAllUserTokens: vi.fn(() => Promise.resolve()),
  createAndStoreRefreshToken: vi.fn(() => Promise.resolve('mock-raw-refresh-token')),
  rotateRefreshToken: vi.fn(() =>
    Promise.resolve({ status: 'rotated', user: { ...PW_USER }, refreshToken: 'new-refresh' })
  ),
  findUserByEmail: mockFindUserByEmail,
  updateUserProfile: vi.fn(() => Promise.resolve({ ...PW_USER })),
  softDeleteUser: vi.fn(() => Promise.resolve()),
  findOrCreateGoogleUser: vi.fn(() => Promise.resolve({ user: { ...PW_USER }, isNewUser: false })),
  findOrCreateUserByIdentity: vi.fn(() =>
    Promise.resolve({ user: { ...PW_USER }, isNewUser: false })
  ),
  generateRefreshToken: vi.fn(() => 'state-fixed-123'),
  hashPassword: mockHashPassword,
  authenticatePassword: vi.fn(() => Promise.resolve(null)),
  createPasswordUser: mockCreatePasswordUser,
  createEmailVerificationToken: vi.fn(() => Promise.resolve('verify-token')),
  consumeEmailVerificationToken: vi.fn(() => Promise.resolve(null)),
  markEmailVerified: mockMarkEmailVerified,
  createPasswordResetToken: vi.fn(() => Promise.resolve('reset-token')),
  consumePasswordResetToken: vi.fn(() => Promise.resolve(null)),
  setUserPassword: mockSetUserPassword,
  // Included so the process-global services/auth mock exposes every export the
  // routes batch consumes. internal.ts imports cleanupExpiredTokens, and this
  // file runs first (alphabetically) and materializes the module shape via its
  // `await import('./auth')`, freezing the export-name set; omitting this export
  // would break internal.ts's static named import at link time.
  cleanupExpiredTokens: vi.fn(() => Promise.resolve(0)),
  REFRESH_TOKEN_DAYS: 7,
}));

vi.mock('../lib/email', () => ({
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  isEmailConfigured: vi.fn(() => true),
}));

const { authRoutes } = await import('./auth');

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

function post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return testApp.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
}

describe('POST /auth/dev/password-user', () => {
  beforeEach(() => {
    mockRateLimit.mockImplementation(() => Promise.resolve());
    mockFindUserByEmail.mockImplementation(() => Promise.resolve(undefined));
    mockCreatePasswordUser.mockImplementation(() =>
      Promise.resolve({ ...PW_USER, emailVerified: false })
    );
    mockCreatePasswordUser.mockClear();
    mockSetUserPassword.mockClear();
    mockHashPassword.mockImplementation(() => Promise.resolve('hashed-password'));
    mockMarkEmailVerified.mockImplementation(() => Promise.resolve({ ...PW_USER }));
    mockMarkEmailVerified.mockClear();
  });

  it('creates and verifies a password user for E2E login setup when the dev secret matches', async () => {
    const res = await post(
      '/auth/dev/password-user',
      { email: 'seeded@example.com', password: 'correct-horse-battery-staple', name: 'Seeded' },
      { 'x-dev-auth-secret': 'test-dev-auth-secret' }
    );

    expect(res.status).toBe(201);
    expect(mockCreatePasswordUser).toHaveBeenCalledTimes(1);
    expect(mockCreatePasswordUser).toHaveBeenCalledWith({
      email: 'seeded@example.com',
      passwordHash: 'hashed-password',
      name: 'Seeded',
    });
    expect(mockMarkEmailVerified).toHaveBeenCalledWith(PW_USER.id);
    await expect(res.json()).resolves.toEqual({
      user: { id: PW_USER.id, email: PW_USER.email, name: null, avatarUrl: null },
    });
  });

  it('is idempotent for an existing password user by replacing the password and verifying the email', async () => {
    mockFindUserByEmail.mockImplementation(() =>
      Promise.resolve({ ...PW_USER, emailVerified: false })
    );

    const res = await post(
      '/auth/dev/password-user',
      { email: 'test@example.com', password: 'new-password-for-e2e' },
      { 'x-dev-auth-secret': 'test-dev-auth-secret' }
    );

    expect(res.status).toBe(201);
    expect(mockCreatePasswordUser).not.toHaveBeenCalled();
    expect(mockSetUserPassword).toHaveBeenCalledWith(PW_USER.id, 'hashed-password');
    expect(mockMarkEmailVerified).toHaveBeenCalledWith(PW_USER.id);
  });

  it('rejects requests that do not include the dev auth secret', async () => {
    const res = await post('/auth/dev/password-user', {
      email: 'seeded@example.com',
      password: 'correct-horse-battery-staple',
    });

    expect(res.status).toBe(401);
    expect(mockCreatePasswordUser).not.toHaveBeenCalled();
    expect(mockSetUserPassword).not.toHaveBeenCalled();
  });
});
