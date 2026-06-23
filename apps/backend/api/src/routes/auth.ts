/**
 * Auth routes — Google OAuth, refresh, signout, me.
 *
 * Access tokens: short-lived JWT (15 min) returned in response body.
 * Refresh tokens: opaque UUID in httpOnly cookie, SHA-256 hashed in DB.
 */
import { Elysia, t } from 'elysia';
import { timingSafeEqual } from 'node:crypto';
import { jwtPlugin, resolveUserId } from '../middleware/auth-guard';
import { ApiError } from '../middleware/error-handler';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import {
  hashToken,
  findRefreshTokenByPreviousHash,
  revokeRefreshToken,
  revokeAllUserTokens,
  createAndStoreRefreshToken,
  rotateRefreshToken,
  findUserById,
  findOrCreateGoogleUser,
  findUserByEmail,
  updateUserProfile,
  softDeleteUser,
  hashPassword,
  authenticatePassword,
  createPasswordUser,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  markEmailVerified,
  createPasswordResetToken,
  consumePasswordResetToken,
  setUserPassword,
  REFRESH_TOKEN_DAYS,
} from '../services/auth';
import {
  getMobileGoogleClientIds,
  getWebGoogleClientId,
  verifyGoogleToken,
} from '../lib/google-auth';
import { sendTelegramMessage } from '../lib/telegram';
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email';

const ACCESS_TOKEN_EXPIRY = process.env['JWT_ACCESS_EXPIRY'] ?? '15m';

// ---------------------------------------------------------------------------
// Device classification (REQ-AUTH-003)
// ---------------------------------------------------------------------------

type DeviceType = 'Mobile' | 'Desktop' | 'Bot' | 'Unknown';

/** Classifies the device type from the User-Agent header value. */
function classifyDevice(userAgent: string | undefined): DeviceType {
  if (!userAgent) return 'Unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) return 'Bot';
  if (/Mobile|Android|iPhone|iPad|iPod/.test(userAgent)) return 'Mobile';
  return 'Desktop';
}

const REFRESH_COOKIE_NAME = 'refresh_token';
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';
// The dev sign-in route mints a full session for ANY email with no Google
// token. Gating it on NODE_ENV alone is fragile: any internet-reachable
// staging/preview env with the flag set becomes a one-request impersonation
// oracle for real accounts. Require a strong shared secret too, and only
// register the route when that secret is actually configured.
const DEV_AUTH_SECRET = process.env['AUTH_DEV_ROUTE_SECRET'] ?? '';
const DEV_AUTH_ENABLED =
  process.env['AUTH_DEV_ROUTE_ENABLED'] === 'true' &&
  !IS_PRODUCTION &&
  DEV_AUTH_SECRET.length >= 16;
const DEV_AUTH_RATE_LIMIT = { maxRequests: 1_000, windowMs: 60_000 };

/** Constant-time comparison of the dev-auth secret header against the configured value. */
function devAuthSecretMatches(provided: string | undefined): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(DEV_AUTH_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Max avatar data URL size in bytes (~200KB base64 ≈ ~150KB image). */
const MAX_AVATAR_BYTES = 200_000;
const DATA_URL_IMAGE_RE =
  /^data:image\/(jpeg|png|webp);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true as const,
  secure: IS_PRODUCTION,
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  path: '/api/auth',
};

interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly avatarUrl: string | null;
}

const userProfileResponseSchema = t.Object({
  id: t.String(),
  email: t.String({ format: 'email' }),
  name: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
});

const mobileGoogleAuthResponseSchema = t.Object({
  user: userProfileResponseSchema,
  accessToken: t.String(),
  refreshToken: t.String(),
});

const mobileRefreshAuthResponseSchema = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
  user: userProfileResponseSchema,
});

function userResponse(user: UserProfile & { avatarUrl?: string | null }): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
  };
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

async function issueMobileTokens(
  jwt: { sign: (payload: { sub: string; email?: string; exp: string }) => Promise<string> },
  user: { id: string; email?: string }
): Promise<{ accessToken: string; refreshToken: string }> {
  const [accessToken, refreshToken] = await Promise.all([
    jwt.sign({
      sub: user.id,
      ...(user.email ? { email: user.email } : {}),
      exp: ACCESS_TOKEN_EXPIRY,
    }),
    createAndStoreRefreshToken(user.id),
  ]);

  return { accessToken, refreshToken };
}

async function refreshAuthToken(
  jwt: { sign: (payload: { sub: string; email?: string; exp: string }) => Promise<string> },
  reqLogger: {
    warn: (context: Record<string, unknown>, message: string) => void;
    info: (context: Record<string, unknown>, message: string) => void;
  },
  refreshToken: string,
  onInvalidatedToken?: () => void
): Promise<{ accessToken: string; refreshToken: string; user: UserProfile }> {
  const tokenHash = await hashToken(refreshToken);
  const rotation = await rotateRefreshToken(tokenHash);

  if (rotation.status === 'not_found') {
    const successor = await findRefreshTokenByPreviousHash(tokenHash);
    if (successor) {
      reqLogger.warn(
        { event: 'auth.token_reuse_detected', userId: successor.userId },
        'refresh token reuse detected — revoking all user sessions'
      );
      await revokeAllUserTokens(successor.userId);
    }
    throw new ApiError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');
  }

  if (rotation.status === 'expired') {
    onInvalidatedToken?.();
    throw new ApiError(401, 'Refresh token expired', 'AUTH_REFRESH_EXPIRED');
  }

  if (rotation.status === 'account_deleted') {
    onInvalidatedToken?.();
    throw new ApiError(401, 'Account has been deleted', 'AUTH_ACCOUNT_DELETED');
  }

  const accessToken = await jwt.sign({
    sub: rotation.user.id,
    exp: ACCESS_TOKEN_EXPIRY,
  });

  reqLogger.info({ event: 'auth.refresh', userId: rotation.user.id }, 'token refreshed');

  return {
    accessToken,
    refreshToken: rotation.refreshToken,
    user: userResponse(rotation.user),
  };
}

async function signOutWithRefreshToken(refreshToken: unknown): Promise<void> {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return;
  }

  const tokenHash = await hashToken(refreshToken);
  await revokeRefreshToken(tokenHash);
}

interface GoogleSignInResult {
  readonly user: { id: string; email: string; name: string | null; avatarUrl: string | null };
  readonly isNewUser: boolean;
}

/**
 * Shared Google sign-in core: verifies the credential, upserts the user, and
 * fires the Telegram new-user notification (fire-and-forget).
 *
 * @param credential      Raw Google ID token from the client.
 * @param allowedClientIds Audience list passed to verifyGoogleToken.
 * @param passthroughApiErrors When true, ApiErrors thrown by verifyGoogleToken
 *   are re-thrown as-is (mobile behaviour). When false, all verification errors
 *   are normalised to 401 AUTH_GOOGLE_INVALID (web behaviour).
 * @param userAgent       Raw User-Agent header value for device classification.
 * @param reqLogger       Request-scoped logger for diagnostic warn output.
 */
async function processGoogleSignIn(
  credential: string,
  allowedClientIds: readonly string[],
  passthroughApiErrors: boolean,
  userAgent: string | null,
  reqLogger: { warn: (context: Record<string, unknown>, message: string) => void }
): Promise<GoogleSignInResult> {
  let googlePayload: Awaited<ReturnType<typeof verifyGoogleToken>>;
  try {
    googlePayload = await verifyGoogleToken(credential, { allowedClientIds });
  } catch (e: unknown) {
    reqLogger.warn({ err: e }, 'Google token verification failed');
    if (passthroughApiErrors && e instanceof ApiError) throw e;
    throw new ApiError(401, 'Invalid Google credential', 'AUTH_GOOGLE_INVALID');
  }

  const { user, isNewUser } = await findOrCreateGoogleUser(
    googlePayload.sub,
    googlePayload.email,
    googlePayload.name
  );

  if (isNewUser) {
    const deviceType = classifyDevice(userAgent ?? undefined);
    const timestamp = new Date().toISOString();
    const text = `New user: ${user.email} | ${deviceType} | ${timestamp}`;
    void sendTelegramMessage(text);
  }

  return { user, isNewUser };
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
    async ({ jwt, body, cookie, set, reqLogger, ip, request }) => {
      await rateLimit(ip, '/auth/google', { maxRequests: 10 });
      const webClientId = getWebGoogleClientId();

      const { user, isNewUser } = await processGoogleSignIn(
        body.credential,
        [webClientId],
        false,
        request.headers.get('user-agent'),
        reqLogger
      );
      const { accessToken } = await issueTokens(jwt, cookie, user);

      reqLogger.info({ event: 'auth.google', userId: user.id, isNewUser }, 'google sign-in');
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

  .post(
    '/mobile/google',
    async ({ jwt, body, set, reqLogger, ip, request }) => {
      await rateLimit(ip, '/auth/mobile/google', { maxRequests: 10 });

      const { user, isNewUser } = await processGoogleSignIn(
        body.credential,
        getMobileGoogleClientIds(),
        true,
        request.headers.get('user-agent'),
        reqLogger
      );
      const tokens = await issueMobileTokens(jwt, user);

      reqLogger.info(
        { event: 'auth.mobile_google', userId: user.id, isNewUser },
        'mobile google sign-in'
      );
      set.status = 200;
      return { user: userResponse(user), ...tokens };
    },
    {
      body: t.Object({ credential: t.String({ minLength: 1 }) }),
      response: {
        200: mobileGoogleAuthResponseSchema,
        401: t.Object(
          { error: t.String(), code: t.String() },
          { description: 'Invalid or expired Google credential' }
        ),
        403: t.Object({ error: t.String(), code: t.String() }, { description: 'Account deleted' }),
        429: t.Object({ error: t.String(), code: t.String() }, { description: 'Rate limited' }),
        500: t.Object(
          { error: t.String(), code: t.String() },
          { description: 'Internal or configuration error' }
        ),
        503: t.Object(
          { error: t.String(), code: t.String() },
          { description: 'Google JWKS unavailable' }
        ),
      },
      detail: {
        tags: ['Auth'],
        summary: 'Sign in with Google for mobile clients',
        description:
          'Verifies a Google ID token, finds or creates the user, and returns both access and refresh tokens in the response body.',
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/signup — email + password registration
  // -----------------------------------------------------------------------
  .post(
    '/signup',
    async ({ body, set, reqLogger, ip, request }) => {
      await rateLimit(ip, '/auth/signup', { maxRequests: 10 });

      const passwordHash = await hashPassword(body.password);
      const user = await createPasswordUser({ email: body.email, passwordHash, name: body.name });

      const token = await createEmailVerificationToken(user.id);
      void sendVerificationEmail(user.email, token);

      const deviceType = classifyDevice(request.headers.get('user-agent') ?? undefined);
      void sendTelegramMessage(
        `New user: ${user.email} | ${deviceType} | ${new Date().toISOString()}`
      );

      reqLogger.info({ event: 'auth.signup', userId: user.id }, 'email signup');
      set.status = 201;
      return { message: 'Account created. Check your email to verify your address.' };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8, maxLength: 200 }),
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Sign up with email and password',
        description:
          'Creates an unverified email/password account and sends a verification email. The user must verify before logging in.',
        responses: {
          201: { description: 'Account created; verification email sent' },
          409: { description: 'Email already registered' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/login — email + password sign-in
  // -----------------------------------------------------------------------
  .post(
    '/login',
    async ({ jwt, body, cookie, set, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/login', { maxRequests: 10 });

      const user = await authenticatePassword(body.email, body.password);
      if (!user) {
        throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      }
      if (!user.emailVerified) {
        throw new ApiError(403, 'Email not verified', 'EMAIL_NOT_VERIFIED');
      }

      const { accessToken } = await issueTokens(jwt, cookie, user);
      reqLogger.info({ event: 'auth.login', userId: user.id }, 'password login');
      set.status = 200;
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 1, maxLength: 200 }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        description:
          'Verifies credentials and issues tokens. Returns a generic 401 for bad credentials (no enumeration) and 403 when the email is unverified.',
        responses: {
          200: { description: 'Authenticated; access token in body, refresh token in cookie' },
          401: { description: 'Invalid credentials' },
          403: { description: 'Email not verified' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/verify-email — confirm address, then auto-login
  // -----------------------------------------------------------------------
  .post(
    '/verify-email',
    async ({ jwt, body, cookie, set, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/verify-email', { maxRequests: 20 });

      const userId = await consumeEmailVerificationToken(body.token);
      if (!userId) {
        throw new ApiError(400, 'Invalid or expired verification token', 'INVALID_TOKEN');
      }
      const user = await markEmailVerified(userId);
      if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
      }

      const { accessToken } = await issueTokens(jwt, cookie, user);
      reqLogger.info({ event: 'auth.email_verified', userId }, 'email verified');
      set.status = 200;
      return { user: userResponse(user), accessToken };
    },
    {
      body: t.Object({ token: t.String({ minLength: 1 }) }),
      detail: {
        tags: ['Auth'],
        summary: 'Verify email address',
        description: 'Consumes a verification token, marks the email verified, and issues tokens.',
        responses: {
          200: { description: 'Email verified; tokens issued' },
          400: { description: 'Invalid or expired token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/forgot-password — request a reset link (always generic 200)
  // -----------------------------------------------------------------------
  .post(
    '/forgot-password',
    async ({ body, set, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/forgot-password', { maxRequests: 5 });

      const user = await findUserByEmail(body.email);
      if (user?.passwordHash) {
        const token = await createPasswordResetToken(user.id);
        void sendPasswordResetEmail(user.email, token);
        reqLogger.info({ event: 'auth.forgot_password', userId: user.id }, 'reset email queued');
      }

      // Always generic — never reveal whether the account exists.
      set.status = 200;
      return { message: 'If an account exists for that email, a reset link has been sent.' };
    },
    {
      body: t.Object({ email: t.String({ format: 'email' }) }),
      detail: {
        tags: ['Auth'],
        summary: 'Request a password reset',
        description:
          'Sends a reset link when a password account exists. Always returns 200 to avoid account enumeration.',
        responses: {
          200: { description: 'Generic acknowledgement' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/reset-password — consume token, set new password, revoke sessions
  // -----------------------------------------------------------------------
  .post(
    '/reset-password',
    async ({ body, set, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/reset-password', { maxRequests: 10 });

      const userId = await consumePasswordResetToken(body.token);
      if (!userId) {
        throw new ApiError(400, 'Invalid or expired reset token', 'INVALID_TOKEN');
      }
      const passwordHash = await hashPassword(body.password);
      await setUserPassword(userId, passwordHash);
      // A reset invalidates every existing session (defense against a compromise).
      await revokeAllUserTokens(userId);

      reqLogger.info({ event: 'auth.password_reset', userId }, 'password reset');
      set.status = 200;
      return { message: 'Password updated. Sign in with your new password.' };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1 }),
        password: t.String({ minLength: 8, maxLength: 200 }),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Reset password',
        description: 'Consumes a reset token, sets a new password, and revokes all sessions.',
        responses: {
          200: { description: 'Password updated' },
          400: { description: 'Invalid or expired token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/dev — dev-only sign-in for E2E tests.
  // Only registered when AUTH_DEV_ROUTE_ENABLED=true and NODE_ENV != production.
  // -----------------------------------------------------------------------
  .use((app) =>
    DEV_AUTH_ENABLED
      ? app.post(
          '/dev',
          async ({ jwt, body, cookie, set, ip, headers }) => {
            await rateLimit(ip, 'POST /auth/dev', DEV_AUTH_RATE_LIMIT);
            if (!devAuthSecretMatches(headers['x-dev-auth-secret'])) {
              throw new ApiError(401, 'Invalid dev auth secret', 'UNAUTHORIZED');
            }
            // Reuse existing user by email (dev logins generate a new googleId each time,
            // which would violate the email unique constraint on repeated calls).
            const existing = await findUserByEmail(body.email);
            const user = existing
              ? existing
              : (await findOrCreateGoogleUser(`dev-${crypto.randomUUID()}`, body.email, undefined))
                  .user;
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
      : app
  )

  // -----------------------------------------------------------------------
  // POST /auth/refresh
  // -----------------------------------------------------------------------
  .post(
    '/refresh',
    async ({ jwt, cookie, reqLogger, ip }) => {
      // In non-production environments (dev, E2E) use a higher limit so
      // parallel test workers don't exhaust the 20/min default.
      await rateLimit(ip, '/auth/refresh', IS_PRODUCTION ? undefined : { maxRequests: 500 });

      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      const tokenValue = refreshCookie?.value;

      if (!tokenValue || typeof tokenValue !== 'string') {
        throw new ApiError(401, 'No refresh token', 'AUTH_NO_REFRESH_TOKEN');
      }

      const refreshed = await refreshAuthToken(jwt, reqLogger, tokenValue, () => {
        refreshCookie.remove();
      });

      refreshCookie.set({ value: refreshed.refreshToken, ...REFRESH_COOKIE_OPTIONS });
      // Include the user so the web client can restore the session in a single
      // round-trip (refresh → user) instead of chaining a follow-up GET /auth/me.
      return { accessToken: refreshed.accessToken, user: userResponse(refreshed.user) };
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        description:
          'Rotates the refresh token (family tracking for theft detection), issues a new short-lived access token, and returns the current user profile.',
        responses: {
          200: { description: 'New access token issued; refresh token cookie rotated' },
          401: { description: 'Missing, invalid, expired, or reused refresh token' },
          429: { description: 'Rate limited' },
        },
      },
    }
  )

  .post(
    '/mobile/refresh',
    async ({ jwt, body, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/mobile/refresh', IS_PRODUCTION ? undefined : { maxRequests: 500 });

      if (!body.refreshToken || body.refreshToken.length === 0) {
        throw new ApiError(401, 'No refresh token', 'AUTH_NO_REFRESH_TOKEN');
      }

      const refreshed = await refreshAuthToken(jwt, reqLogger, body.refreshToken);
      return refreshed;
    },
    {
      body: t.Object({ refreshToken: t.Optional(t.String()) }),
      response: {
        200: mobileRefreshAuthResponseSchema,
        401: t.Object(
          { error: t.String(), code: t.String() },
          { description: 'Missing, invalid, expired, or reused refresh token' }
        ),
        429: t.Object({ error: t.String(), code: t.String() }, { description: 'Rate limited' }),
      },
      detail: {
        tags: ['Auth'],
        summary: 'Refresh mobile auth tokens',
        description:
          'Rotates the mobile refresh token and returns a new access token, refresh token, and current user profile in the response body.',
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
      await signOutWithRefreshToken(refreshCookie?.value);

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

  .post(
    '/mobile/signout',
    async ({ body, set, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/mobile/signout');

      await signOutWithRefreshToken(body.refreshToken);

      reqLogger.info({ event: 'auth.mobile_signout' }, 'mobile user signed out');
      set.status = 204;
    },
    {
      body: t.Object({ refreshToken: t.Optional(t.String()) }),
      response: {
        429: t.Object({ error: t.String(), code: t.String() }, { description: 'Rate limited' }),
      },
      detail: {
        tags: ['Auth'],
        summary: 'Sign out mobile client',
        description: 'Revokes the provided refresh token when present.',
      },
    }
  )

  // -----------------------------------------------------------------------
  // GET /auth/me — return current user info from bearer token
  // -----------------------------------------------------------------------
  .get(
    '/me',
    async ({ jwt, headers }) => {
      const { userId } = await resolveUserId({ jwt, headers });
      await rateLimit(userId, 'GET /auth/me', { maxRequests: 100 });

      const user = await findUserById(userId);
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
        // Validate base64 roundtrip to reject corrupted/malformed payloads
        const b64Part = body.avatarUrl.split(',')[1];
        if (!b64Part || b64Part.length === 0) {
          throw new ApiError(400, 'Empty avatar data', 'INVALID_AVATAR');
        }
        try {
          const decoded = Buffer.from(b64Part, 'base64');
          if (decoded.toString('base64') !== b64Part) {
            throw new ApiError(400, 'Invalid base64 in avatar', 'INVALID_AVATAR');
          }
        } catch (e: unknown) {
          if (e instanceof ApiError) throw e;
          throw new ApiError(400, 'Invalid base64 in avatar', 'INVALID_AVATAR');
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
