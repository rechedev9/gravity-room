/**
 * Auth routes — Google OAuth, refresh, signout, me.
 *
 * Access tokens: short-lived JWT (15 min) returned in response body.
 * Refresh tokens: opaque UUID in httpOnly cookie, SHA-256 hashed in DB.
 */
import { Elysia, t } from 'elysia';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { ApiError } from '../middleware/error-handler';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import {
  hashToken,
  findUserById,
  findRefreshToken,
  findRefreshTokenByPreviousHash,
  revokeRefreshToken,
  revokeAllUserTokens,
  createAndStoreRefreshToken,
  findOrCreateGoogleUser,
  updateUserProfile,
  softDeleteUser,
  REFRESH_TOKEN_DAYS,
} from '../services/auth';
import { verifyGoogleToken } from '../lib/google-auth';

const ACCESS_TOKEN_EXPIRY = process.env['JWT_ACCESS_EXPIRY'] ?? '15m';
const REFRESH_COOKIE_NAME = 'refresh_token';
const BEARER_PREFIX = 'Bearer ';
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';

/** Max avatar data URL size in bytes (~200KB base64 ≈ ~150KB image). */
const MAX_AVATAR_BYTES = 200_000;
const DATA_URL_IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true as const,
  secure: IS_PRODUCTION,
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  path: '/auth',
};

interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly avatarUrl: string | null;
}

function userResponse(user: UserProfile): UserProfile {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
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

  cookie[REFRESH_COOKIE_NAME].set({ value: refreshToken, ...REFRESH_COOKIE_OPTIONS });
  return { accessToken };
}

const authSecurity = [{ bearerAuth: [] }];

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(requestLogger)
  .use(jwtPlugin)

  // -----------------------------------------------------------------------
  // POST /auth/google — verify Google ID token, find or create user
  // -----------------------------------------------------------------------
  .post(
    '/google',
    async ({ jwt, body, cookie, set, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/google', { maxRequests: 10 });

      let googlePayload: Awaited<ReturnType<typeof verifyGoogleToken>>;
      try {
        googlePayload = await verifyGoogleToken(body.credential);
      } catch (e: unknown) {
        reqLogger.warn({ err: e }, 'Google token verification failed');
        throw new ApiError(401, 'Invalid Google credential', 'AUTH_GOOGLE_INVALID');
      }

      const user = await findOrCreateGoogleUser(
        googlePayload.sub,
        googlePayload.email,
        googlePayload.name
      );
      const { accessToken } = await issueTokens(jwt, cookie, user);

      reqLogger.info({ event: 'auth.google', userId: user.id }, 'google sign-in');
      set.status = 200;
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({ credential: t.String({ minLength: 1 }) }),
      detail: {
        tags: ['Auth'],
        summary: 'Sign in with Google',
        description:
          'Verifies a Google ID token (RS256 + JWKS), finds or creates the user, and issues tokens.',
        responses: {
          200: { description: 'Authenticated; access token in body, refresh token in cookie' },
          401: { description: 'Invalid or expired Google credential' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/dev — dev-only sign-in for E2E tests (returns 404 in production)
  // -----------------------------------------------------------------------
  .post(
    '/dev',
    async ({ jwt, body, cookie, set }) => {
      if (IS_PRODUCTION) {
        throw new ApiError(404, 'Not found', 'NOT_FOUND');
      }
      const googleId = `dev-${crypto.randomUUID()}`;
      const user = await findOrCreateGoogleUser(googleId, body.email, undefined);
      const { accessToken } = await issueTokens(jwt, cookie, user);
      set.status = 201;
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
      }),
      detail: { tags: ['Auth'], summary: 'Dev-only test sign-in (404 in production)' },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/refresh
  // -----------------------------------------------------------------------
  .post(
    '/refresh',
    async ({ jwt, cookie, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/refresh');

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

      refreshCookie.set({ value: newRefreshToken, ...REFRESH_COOKIE_OPTIONS });

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
      await rateLimit(ip, '/auth/signout');

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
      if (!authorization?.startsWith(BEARER_PREFIX)) {
        throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
      }

      const token = authorization.slice(BEARER_PREFIX.length);
      if (!token) {
        throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
      }

      const payload = await jwt.verify(token);
      if (!payload || typeof payload['sub'] !== 'string') {
        throw new ApiError(401, 'Invalid or expired token', 'TOKEN_INVALID');
      }

      const user = await findUserById(payload['sub']);
      if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
      }

      return userResponse(user);
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
  // PATCH /auth/me — update current user profile
  // -----------------------------------------------------------------------
  .resolve(resolveUserId)
  .patch(
    '/me',
    async ({ userId, body, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/me/patch', { maxRequests: 20 });

      if (body.avatarUrl !== undefined && body.avatarUrl !== null) {
        if (!DATA_URL_IMAGE_RE.test(body.avatarUrl)) {
          throw new ApiError(
            400,
            'Avatar must be a base64 data URL (JPEG, PNG, or WebP)',
            'INVALID_AVATAR'
          );
        }
        if (body.avatarUrl.length > MAX_AVATAR_BYTES) {
          throw new ApiError(400, 'Avatar exceeds maximum size (200KB)', 'AVATAR_TOO_LARGE');
        }
      }

      const updated = await updateUserProfile(userId, {
        name: body.name,
        avatarUrl: body.avatarUrl,
      });

      reqLogger.info({ event: 'auth.profile_update', userId }, 'profile updated');
      return userResponse(updated);
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        avatarUrl: t.Optional(t.Nullable(t.String())),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Update user profile',
        description: 'Updates name and/or avatar. Send avatarUrl: null to remove the avatar.',
        security: authSecurity,
        responses: {
          200: { description: 'Updated user profile' },
          400: { description: 'Invalid avatar format or size' },
          401: { description: 'Missing or invalid token' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // DELETE /auth/me — soft-delete current user account
  // -----------------------------------------------------------------------
  .delete(
    '/me',
    async ({ userId, cookie, set, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/me/delete', { maxRequests: 5 });

      await softDeleteUser(userId);

      // Clear the refresh cookie
      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      refreshCookie?.remove();

      reqLogger.info({ event: 'auth.account_deleted', userId }, 'account soft-deleted');
      set.status = 204;
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Delete account',
        description:
          'Soft-deletes the user account (sets deleted_at). All refresh tokens are revoked. Data is purged after 30 days.',
        security: authSecurity,
        responses: {
          204: { description: 'Account soft-deleted' },
          401: { description: 'Missing or invalid token' },
        },
      },
    }
  );
