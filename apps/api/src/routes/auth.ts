/**
 * Auth routes — signup, signin, refresh, signout, me.
 *
 * Access tokens: short-lived JWT (15 min) returned in response body.
 * Refresh tokens: opaque UUID in httpOnly cookie, SHA-256 hashed in DB.
 */
import { Elysia, t } from 'elysia';
import { jwtPlugin } from '../middleware/auth-guard';
import { ApiError } from '../middleware/error-handler';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  createUser,
  findUserByEmail,
  findUserById,
  findRefreshToken,
  findRefreshTokenByPreviousHash,
  revokeRefreshToken,
  revokeAllUserTokens,
  createAndStoreRefreshToken,
  createPasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  REFRESH_TOKEN_DAYS,
} from '../services/auth';
import { checkLeakedPassword } from '../lib/password-check';
import { sendPasswordResetEmail } from '../lib/email';

const ACCESS_TOKEN_EXPIRY = process.env['JWT_ACCESS_EXPIRY'] ?? '15m';
const REFRESH_COOKIE_NAME = 'refresh_token';

function isProductionEnv(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

function refreshCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    secure: isProductionEnv(),
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
    path: '/auth',
  };
}

function userResponse(user: { id: string; email: string; name: string | null }): {
  id: string;
  email: string;
  name: string | null;
} {
  return { id: user.id, email: user.email, name: user.name };
}

/** Signs a JWT, creates a refresh token, and sets the cookie in one step. */
async function issueTokens(
  jwt: { sign: (payload: { sub: string; email?: string; exp: string }) => Promise<string> },
  cookie: Record<string, { set: (opts: Record<string, unknown>) => void }>,
  user: { id: string; email?: string }
): Promise<{ accessToken: string }> {
  const [accessToken, refreshToken] = await Promise.all([
    jwt.sign({
      sub: user.id,
      ...(user.email ? { email: user.email } : {}),
      exp: ACCESS_TOKEN_EXPIRY,
    }),
    createAndStoreRefreshToken(user.id),
  ]);

  cookie[REFRESH_COOKIE_NAME].set({ value: refreshToken, ...refreshCookieOptions() });
  return { accessToken };
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(requestLogger)
  .use(jwtPlugin)

  // -----------------------------------------------------------------------
  // POST /auth/signup
  // -----------------------------------------------------------------------
  .post(
    '/signup',
    async ({ jwt, body, cookie, set, reqLogger, ip }) => {
      rateLimit(ip, '/auth/signup');

      const [leaked, existing] = await Promise.all([
        checkLeakedPassword(body.password),
        findUserByEmail(body.email),
      ]);

      if (leaked) {
        throw new ApiError(400, 'Password found in known data breaches', 'WEAK_PASSWORD');
      }
      if (existing) {
        throw new ApiError(409, 'Email already registered', 'AUTH_EMAIL_EXISTS');
      }

      const passwordHash = await hashPassword(body.password);
      const user = await createUser(body.email, passwordHash, body.name);
      const { accessToken } = await issueTokens(jwt, cookie, user);

      reqLogger.info({ event: 'auth.signup', userId: user.id }, 'user registered');
      set.status = 201;
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      }),
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/signin
  // -----------------------------------------------------------------------
  .post(
    '/signin',
    async ({ jwt, body, cookie, reqLogger, ip }) => {
      rateLimit(ip, '/auth/signin');
      const user = await findUserByEmail(body.email);
      if (!user) {
        throw new ApiError(401, 'Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
      }

      const valid = await verifyPassword(body.password, user.passwordHash);
      if (!valid) {
        throw new ApiError(401, 'Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
      }

      const { accessToken } = await issueTokens(jwt, cookie, user);

      reqLogger.info({ event: 'auth.signin', userId: user.id }, 'user signed in');
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
      }),
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/refresh
  // -----------------------------------------------------------------------
  .post('/refresh', async ({ jwt, cookie, reqLogger, ip }) => {
    rateLimit(ip, '/auth/refresh');

    const refreshCookie = cookie[REFRESH_COOKIE_NAME];
    const tokenValue = refreshCookie?.value;

    if (!tokenValue || typeof tokenValue !== 'string') {
      throw new ApiError(401, 'No refresh token', 'AUTH_NO_REFRESH_TOKEN');
    }

    const tokenHash = await hashToken(tokenValue);
    const stored = await findRefreshToken(tokenHash);

    if (!stored) {
      // Token not found — check if it was already rotated (indicates possible theft)
      const successor = await findRefreshTokenByPreviousHash(tokenHash);
      if (successor) {
        // A live token claims this as its predecessor → the old token was reused.
        // Revoke all sessions for this user as a precaution.
        reqLogger.warn(
          { event: 'auth.token_reuse_detected', userId: successor.userId },
          'refresh token reuse detected — revoking all user sessions'
        );
        await revokeAllUserTokens(successor.userId);
      }
      throw new ApiError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');
    }

    if (stored.expiresAt < new Date()) {
      await revokeRefreshToken(tokenHash);
      refreshCookie.remove();
      throw new ApiError(401, 'Refresh token expired', 'AUTH_REFRESH_EXPIRED');
    }

    // Rotate: revoke old token, issue new one — pass hash so successor can detect reuse
    await revokeRefreshToken(tokenHash);
    const newRefreshToken = await createAndStoreRefreshToken(stored.userId, tokenHash);

    const accessToken = await jwt.sign({
      sub: stored.userId,
      exp: ACCESS_TOKEN_EXPIRY,
    });

    refreshCookie.set({ value: newRefreshToken, ...refreshCookieOptions() });

    reqLogger.info({ event: 'auth.refresh', userId: stored.userId }, 'token refreshed');
    return { accessToken };
  })

  // -----------------------------------------------------------------------
  // POST /auth/signout
  // -----------------------------------------------------------------------
  .post('/signout', async ({ cookie, set, reqLogger, ip }) => {
    rateLimit(ip, '/auth/signout');

    const refreshCookie = cookie[REFRESH_COOKIE_NAME];
    const tokenValue = refreshCookie?.value;

    if (tokenValue && typeof tokenValue === 'string') {
      const tokenHash = await hashToken(tokenValue);
      await revokeRefreshToken(tokenHash);
    }

    refreshCookie?.remove();
    reqLogger.info({ event: 'auth.signout' }, 'user signed out');
    set.status = 204;
  })

  // -----------------------------------------------------------------------
  // GET /auth/me — return current user info from bearer token
  // -----------------------------------------------------------------------
  .get('/me', async ({ jwt, headers }) => {
    const authorization = headers['authorization'];
    if (!authorization?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
    }

    const payload = await jwt.verify(authorization.slice(7));
    if (!payload || typeof payload['sub'] !== 'string') {
      throw new ApiError(401, 'Invalid or expired token', 'TOKEN_INVALID');
    }

    const user = await findUserById(payload['sub']);
    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }

    return { id: user.id, email: user.email, name: user.name };
  })

  // -----------------------------------------------------------------------
  // POST /auth/forgot-password — trigger password reset email
  // -----------------------------------------------------------------------
  .post(
    '/forgot-password',
    async ({ body, reqLogger, ip }) => {
      rateLimit(ip, '/auth/forgot-password');

      // Always return 200 — never reveal whether the email exists
      const user = await findUserByEmail(body.email);
      if (user) {
        const token = await createPasswordResetToken(user.id);
        const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000';
        const resetUrl = `${APP_URL}/reset-password?token=${token}`;
        await sendPasswordResetEmail(user.email, resetUrl).catch((e: unknown) => {
          reqLogger.error({ err: e }, 'Failed to send reset email');
        });
      }

      return { message: 'If that email is registered, you will receive a reset link.' };
    },
    {
      body: t.Object({ email: t.String({ format: 'email' }) }),
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/reset-password — complete password reset with token
  // -----------------------------------------------------------------------
  .post(
    '/reset-password',
    async ({ body }) => {
      const leaked = await checkLeakedPassword(body.password);
      if (leaked) {
        throw new ApiError(400, 'Password found in known data breaches', 'WEAK_PASSWORD');
      }

      const tokenHash = await hashToken(body.token);
      const record = await findPasswordResetToken(tokenHash);
      if (!record) {
        throw new ApiError(400, 'Invalid or expired reset token', 'RESET_TOKEN_INVALID');
      }

      await markPasswordResetTokenUsed(tokenHash, body.password);
      return { message: 'Password reset successfully.' };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        password: t.String({ minLength: 8 }),
      }),
    }
  );
