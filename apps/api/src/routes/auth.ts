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

const authSecurity = [{ bearerAuth: [] }];

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
      detail: {
        tags: ['Auth'],
        summary: 'Register a new user',
        description:
          'Creates a user account and issues a short-lived access token plus a rotating httpOnly refresh token cookie.',
        responses: {
          201: { description: 'User created; access token in body, refresh token in cookie' },
          400: { description: 'Validation error or password found in breach databases' },
          409: { description: 'Email already registered' },
          429: { description: 'Rate limited' },
        },
      },
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
      detail: {
        tags: ['Auth'],
        summary: 'Sign in',
        description:
          'Authenticates with email and password. Returns an access token and sets a refresh token cookie.',
        responses: {
          200: { description: 'Authenticated; access token in body, refresh token in cookie' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/refresh
  // -----------------------------------------------------------------------
  .post(
    '/refresh',
    async ({ jwt, cookie, reqLogger, ip }) => {
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
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        description:
          'Rotates the refresh token (family tracking for theft detection) and issues a new short-lived access token.',
        responses: {
          200: { description: 'New access token issued; refresh token cookie rotated' },
          401: { description: 'Missing, invalid, expired, or reused refresh token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/signout
  // -----------------------------------------------------------------------
  .post(
    '/signout',
    async ({ cookie, set, reqLogger, ip }) => {
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
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Sign out',
        description: 'Revokes the current refresh token and clears the cookie.',
        responses: {
          204: { description: 'Signed out successfully' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // GET /auth/me — return current user info from bearer token
  // -----------------------------------------------------------------------
  .get(
    '/me',
    async ({ jwt, headers }) => {
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
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Get current user',
        description: "Returns the authenticated user's profile from the Bearer access token.",
        security: authSecurity,
        responses: {
          200: { description: 'User profile' },
          401: { description: 'Missing or invalid token' },
          404: { description: 'User not found (deleted after token was issued)' },
        },
      },
    }
  )

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
      detail: {
        tags: ['Auth'],
        summary: 'Request password reset',
        description:
          'Sends a one-time reset link to the email address if it is registered. Always returns 200 to prevent email enumeration.',
        responses: {
          200: { description: 'Always returns 200 regardless of whether the email exists' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/reset-password — complete password reset with token
  // -----------------------------------------------------------------------
  .post(
    '/reset-password',
    async ({ body, reqLogger }) => {
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
      reqLogger.info(
        { event: 'auth.password_reset', userId: record.userId },
        'password reset completed'
      );
      return { message: 'Password reset successfully.' };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        password: t.String({ minLength: 8 }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Complete password reset',
        description:
          'Validates the one-time token, updates the password (Argon2id), and revokes all active sessions.',
        responses: {
          200: { description: 'Password updated; all sessions revoked' },
          400: { description: 'Invalid/expired token or weak password' },
        },
      },
    }
  );
