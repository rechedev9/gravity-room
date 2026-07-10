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
  findOrCreateUserByIdentity,
  generateRefreshToken,
  findUserByEmail,
  updateUserProfile,
  softDeleteUser,
  hashPassword,
  authenticatePassword,
  createPasswordUser,
  createEmailVerificationToken,
  replaceEmailVerificationToken,
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
import { isEmailConfigured, sendVerificationEmail, sendPasswordResetEmail } from '../lib/email';
import { getApiBaseUrl, getWebBaseUrl } from '../lib/app-url';
import { keepAlive } from '../lib/wait-until';
import {
  isAppleConfigured,
  buildAppleAuthorizeUrl,
  verifyAppleIdToken,
  parseAppleUserName,
} from '../lib/apple-auth';
import {
  isGitHubConfigured,
  buildGitHubAuthorizeUrl,
  exchangeGitHubCode,
  generatePkceVerifier,
  pkceChallenge,
  fetchGitHubIdentity,
} from '../lib/github-auth';
import {
  isMicrosoftConfigured,
  buildMicrosoftAuthorizeUrl,
  exchangeMicrosoftCode,
  fetchMicrosoftIdentity,
} from '../lib/microsoft-auth';

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
// Grace window for concurrent/double refreshes. When a presented refresh token
// is gone but its successor was minted within this window, it is a benign race
// (two tabs sharing one cookie jar refresh in parallel; request 1 rotates A→B,
// request 2 still presents A), NOT theft. A successor OLDER than this can only
// be a replay of a token that was legitimately rotated away long ago, which is
// treated as theft. Sized to comfortably cover client retry/latency without
// giving a real stolen token a meaningful reuse window.
const REFRESH_REUSE_GRACE_MS = 10_000;
const MAX_AUTH_TOKEN_CHARS = 256;
const MAX_EMAIL_CHARS = 254;
const MAX_OAUTH_CODE_CHARS = 4096;
const MAX_OAUTH_ERROR_CHARS = 512;
const MAX_OAUTH_ID_TOKEN_CHARS = 12_000;
const MAX_OAUTH_USER_CHARS = 4096;
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
// The dev route 404s in production, so this only ever applies to preview/staging
// envs where it is deliberately enabled. Even there the secret is compared in
// constant time and must be ≥16 chars, but a tight per-IP cap is cheap
// defense-in-depth against anyone hammering the secret. 60/min stays well above
// any legitimate scripted dev/QA usage.
const DEV_AUTH_RATE_LIMIT = { maxRequests: 60, windowMs: 60_000 };
const emailInputSchema = t.String({ format: 'email', maxLength: MAX_EMAIL_CHARS });

/** Credential-accepting routes must not lose brute-force protection on Redis errors. */
function authRateLimit(
  key: string,
  endpoint: string,
  opts?: { windowMs?: number; maxRequests?: number }
): Promise<void> {
  return rateLimit(key, endpoint, { ...opts, failClosed: true });
}

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

/**
 * Confirm the decoded avatar bytes actually carry the magic-byte signature of
 * the MIME type the data URL claims. The regex + base64 round-trip only proves
 * the payload is well-formed base64 with an image-ish prefix; without this an
 * attacker could store arbitrary non-image bytes (or a mislabelled format) under
 * an `image/*` label. We reject anything whose leading bytes don't match the
 * declared raster format.
 */
function avatarSignatureMatches(declaredType: string, buf: Buffer): boolean {
  switch (declaredType) {
    case 'jpeg':
      // SOI marker: FF D8 FF
      return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'png':
      // 89 50 4E 47 0D 0A 1A 0A
      return (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    case 'webp':
      // RIFF....WEBP
      return (
        buf.length >= 12 &&
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP'
      );
    default:
      return false;
  }
}

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true as const,
  secure: IS_PRODUCTION,
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  path: '/api/auth',
};

/**
 * Expire (delete) a path-scoped cookie by re-setting it empty at the same Path it
 * was created with, plus maxAge 0 / expires epoch. Elysia's `cookie.remove()`
 * emits the deletion at the default path `/`, which would NOT match a cookie
 * scoped to `/api/auth`, leaving it stranded in the browser. Pinning the Path
 * guarantees the deletion matches regardless of which request URL triggered it.
 */
function expireCookieAtPath(
  cookie: { set: (opts: Record<string, unknown>) => void },
  options: {
    readonly path: string;
    readonly httpOnly: boolean;
    readonly secure: boolean;
    readonly sameSite: 'strict' | 'lax' | 'none';
  }
): void {
  cookie.set({
    value: '',
    path: options.path,
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    maxAge: 0,
    expires: new Date(0),
  });
}

/** Expire the refresh cookie, pinned to its `/api/auth` Path. */
function removeRefreshCookie(refreshCookie: {
  set: (opts: Record<string, unknown>) => void;
}): void {
  expireCookieAtPath(refreshCookie, REFRESH_COOKIE_OPTIONS);
}

function assertEmailConfiguredForProduction(): void {
  if (process.env['NODE_ENV'] !== 'production' || isEmailConfigured()) return;
  throw new ApiError(503, 'Email delivery is not configured', 'EMAIL_NOT_CONFIGURED');
}

function isEmailPasswordAvailable(): boolean {
  return process.env['NODE_ENV'] !== 'production' || isEmailConfigured();
}

function isGoogleConfigured(): boolean {
  return Boolean(process.env['GOOGLE_CLIENT_ID']?.trim());
}

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
  jwt: {
    sign: (payload: { sub: string; email?: string; av: number; exp: string }) => Promise<string>;
  },
  cookie: Record<string, { set: (opts: Record<string, unknown>) => void }>,
  user: { id: string; email?: string; authVersion?: number }
): Promise<{ accessToken: string }> {
  const [accessToken, refreshToken] = await Promise.all([
    jwt.sign({
      sub: user.id,
      ...(user.email ? { email: user.email } : {}),
      av: user.authVersion ?? 0,
      exp: ACCESS_TOKEN_EXPIRY,
    }),
    createAndStoreRefreshToken(user.id),
  ]);

  cookie[REFRESH_COOKIE_NAME].set({ value: refreshToken, ...REFRESH_COOKIE_OPTIONS });
  return { accessToken };
}

async function issueMobileTokens(
  jwt: {
    sign: (payload: { sub: string; email?: string; av: number; exp: string }) => Promise<string>;
  },
  user: { id: string; email?: string; authVersion?: number }
): Promise<{ accessToken: string; refreshToken: string }> {
  const [accessToken, refreshToken] = await Promise.all([
    jwt.sign({
      sub: user.id,
      ...(user.email ? { email: user.email } : {}),
      av: user.authVersion ?? 0,
      exp: ACCESS_TOKEN_EXPIRY,
    }),
    createAndStoreRefreshToken(user.id),
  ]);

  return { accessToken, refreshToken };
}

async function refreshAuthToken(
  jwt: {
    sign: (payload: { sub: string; email?: string; av: number; exp: string }) => Promise<string>;
  },
  reqLogger: {
    warn: (context: Record<string, unknown>, message: string) => void;
    info: (context: Record<string, unknown>, message: string) => void;
  },
  refreshToken: string,
  onInvalidatedToken?: () => void
): Promise<{ accessToken: string; refreshToken: string; user: UserProfile }> {
  if (refreshToken.length > MAX_AUTH_TOKEN_CHARS) {
    onInvalidatedToken?.();
    throw new ApiError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');
  }

  const tokenHash = await hashToken(refreshToken);
  const rotation = await rotateRefreshToken(tokenHash);

  if (rotation.status === 'not_found') {
    const successor = await findRefreshTokenByPreviousHash(tokenHash);
    if (successor) {
      const successorAgeMs = Date.now() - successor.createdAt.getTime();
      if (successorAgeMs <= REFRESH_REUSE_GRACE_MS) {
        // Benign concurrent/double refresh: the presented token was rotated away
        // only moments ago by a sibling request (tabs share one cookie jar, so
        // both can carry the same still-valid cookie). Do NOT revoke sessions,
        // bump authVersion, or touch the cookie — clearing it here would strand
        // the sibling tab whose refresh already installed the successor. Answer
        // 401 so the client retries; its next attempt presents the rotated
        // successor cookie and succeeds.
        reqLogger.info(
          { event: 'auth.concurrent_refresh', userId: successor.userId },
          'concurrent refresh within grace window — not revoking'
        );
        throw new ApiError(401, 'Invalid refresh token', 'AUTH_INVALID_REFRESH');
      }
      // Successor is older than the grace window: the presented token was
      // legitimately rotated away long ago, so re-presenting it is a genuine
      // replay of a stale token — treat as theft and revoke the whole family.
      reqLogger.warn(
        { event: 'auth.token_reuse_detected', userId: successor.userId },
        'refresh token reuse detected — revoking all user sessions'
      );
      await revokeAllUserTokens(successor.userId);
    }
    onInvalidatedToken?.();
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
    av: rotation.user.authVersion,
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
  if (refreshToken.length > MAX_AUTH_TOKEN_CHARS) {
    return;
  }

  const tokenHash = await hashToken(refreshToken);
  await revokeRefreshToken(tokenHash);

  // A concurrent refresh may already have consumed this token and created its
  // successor. Revoke the whole family in that case so a delayed refresh
  // response cannot reinstall a still-valid session after logout.
  const successor = await findRefreshTokenByPreviousHash(tokenHash);
  if (successor) await revokeAllUserTokens(successor.userId);
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
    keepAlive(sendTelegramMessage(text));
  }

  return { user, isNewUser };
}

// ---------------------------------------------------------------------------
// Social sign-in (Apple, GitHub) — server-side redirect flows
// ---------------------------------------------------------------------------

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_NONCE_COOKIE = 'oauth_nonce';
const OAUTH_PKCE_COOKIE = 'oauth_pkce';
const OAUTH_STATE_TTL_S = 10 * 60; // 10 minutes

/**
 * State-cookie options. Apple replies via cross-site form_post (needs
 * SameSite=None, which mandates Secure); GitHub returns via a top-level GET
 * navigation, where Lax is sufficient.
 */
function stateCookieOptions(sameSite: 'lax' | 'none'): Record<string, unknown> {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION || sameSite === 'none',
    sameSite,
    maxAge: OAUTH_STATE_TTL_S,
    path: '/api/auth',
  };
}

/**
 * Expire an OAuth CSRF/state/nonce/PKCE cookie at its own `/api/auth` Path with
 * the same attributes it was set with. Like the refresh cookie, these are scoped
 * to `/api/auth`, so a default-path `cookie.remove()` would not match and clear
 * them. Pass the same `sameSite` used when the cookie was created.
 */
function removeStateCookie(
  cookie: { set: (opts: Record<string, unknown>) => void } | undefined,
  sameSite: 'lax' | 'none'
): void {
  if (!cookie) return;
  cookie.set({ ...stateCookieOptions(sameSite), value: '', maxAge: 0, expires: new Date(0) });
}

/** Builds the SPA callback URL the browser is redirected to, with an optional error code. */
function socialCallbackUrl(request: Request, provider: string, error?: string): string {
  const base = `${getWebBaseUrl(request)}/auth/callback`;
  return error
    ? `${base}?provider=${provider}&error=${encodeURIComponent(error)}`
    : `${base}?provider=${provider}`;
}

/** Maps a findOrCreateUserByIdentity ApiError to a stable callback error code. */
function identityErrorCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'ACCOUNT_DELETED') return 'account_deleted';
    if (error.code === 'ACCOUNT_EXISTS_DIFFERENT_METHOD') return 'account_exists';
  }
  return 'signin_failed';
}

const authSecurity = [{ bearerAuth: [] }];

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(requestLogger)
  .use(jwtPlugin)

  // -----------------------------------------------------------------------
  // GET /auth/providers — public provider availability, no secrets exposed
  // -----------------------------------------------------------------------
  .get(
    '/providers',
    async ({ ip }) => {
      await rateLimit(ip, '/auth/providers', { maxRequests: 100 });

      return {
        emailPassword: isEmailPasswordAvailable(),
        google: isGoogleConfigured(),
        apple: isAppleConfigured(),
        github: isGitHubConfigured(),
        microsoft: isMicrosoftConfigured(),
      };
    },
    {
      response: t.Object({
        emailPassword: t.Boolean(),
        google: t.Boolean(),
        apple: t.Boolean(),
        github: t.Boolean(),
        microsoft: t.Boolean(),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'List available sign-in providers',
        description:
          'Returns public booleans for sign-in methods the current deployment can start. Does not expose provider credentials.',
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/google — verify Google ID token, find or create user
  // -----------------------------------------------------------------------
  .post(
    '/google',
    async ({ jwt, body, cookie, set, reqLogger, ip, request }) => {
      await authRateLimit(ip, '/auth/google', { maxRequests: 10 });
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
      body: t.Object({
        credential: t.String({ minLength: 1, maxLength: MAX_OAUTH_ID_TOKEN_CHARS }),
      }),
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
      await authRateLimit(ip, '/auth/mobile/google', { maxRequests: 10 });

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
      body: t.Object({
        credential: t.String({ minLength: 1, maxLength: MAX_OAUTH_ID_TOKEN_CHARS }),
      }),
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
      await authRateLimit(ip, '/auth/signup', { maxRequests: 10 });
      assertEmailConfiguredForProduction();

      const passwordHash = await hashPassword(body.password);
      const user = await createPasswordUser({ email: body.email, passwordHash, name: body.name });

      const token = await createEmailVerificationToken(user.id);
      keepAlive(sendVerificationEmail(user.email, token, request));

      const deviceType = classifyDevice(request.headers.get('user-agent') ?? undefined);
      keepAlive(
        sendTelegramMessage(`New user: ${user.email} | ${deviceType} | ${new Date().toISOString()}`)
      );

      reqLogger.info({ event: 'auth.signup', userId: user.id }, 'email signup');
      set.status = 201;
      return { message: 'Account created. Check your email to verify your address.' };
    },
    {
      body: t.Object({
        email: emailInputSchema,
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
      await authRateLimit(ip, '/auth/login', { maxRequests: 10 });

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
        email: emailInputSchema,
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
      await authRateLimit(ip, '/auth/verify-email', { maxRequests: 20 });

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
      body: t.Object({ token: t.String({ minLength: 1, maxLength: MAX_AUTH_TOKEN_CHARS }) }),
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
  // POST /auth/resend-verification - re-send the verification email (generic 200)
  // -----------------------------------------------------------------------
  .post(
    '/resend-verification',
    async ({ body, set, reqLogger, ip, request }) => {
      await authRateLimit(ip, '/auth/resend-verification', { maxRequests: 5 });
      assertEmailConfiguredForProduction();

      const user = await findUserByEmail(body.email);
      // Only re-send for an existing, still-unverified password account. Already
      // verified accounts, OAuth-only accounts (no password hash), and unknown
      // emails are all silently ignored so the response never reveals whether -
      // or in what state - an account exists. Replacing the token invalidates any
      // earlier verification link the user may still be holding.
      if (user?.passwordHash && !user.emailVerified) {
        const token = await replaceEmailVerificationToken(user.id);
        keepAlive(sendVerificationEmail(user.email, token, request));
        reqLogger.info(
          { event: 'auth.resend_verification', userId: user.id },
          'verification email re-queued'
        );
      }

      // Always generic - never reveal whether the account exists or its state.
      set.status = 200;
      return {
        message:
          'If an account exists for that email and still needs verification, a new link has been sent.',
      };
    },
    {
      body: t.Object({ email: emailInputSchema }),
      detail: {
        tags: ['Auth'],
        summary: 'Resend the email verification link',
        description:
          'Re-sends the verification email when an unverified password account exists, replacing any earlier link. Always returns 200 to avoid account enumeration.',
        responses: {
          200: { description: 'Generic acknowledgement' },
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
    async ({ body, set, reqLogger, ip, request }) => {
      await authRateLimit(ip, '/auth/forgot-password', { maxRequests: 5 });
      assertEmailConfiguredForProduction();

      const user = await findUserByEmail(body.email);
      if (user?.passwordHash) {
        const token = await createPasswordResetToken(user.id);
        keepAlive(sendPasswordResetEmail(user.email, token, request));
        reqLogger.info({ event: 'auth.forgot_password', userId: user.id }, 'reset email queued');
      }

      // Always generic — never reveal whether the account exists.
      set.status = 200;
      return { message: 'If an account exists for that email, a reset link has been sent.' };
    },
    {
      body: t.Object({ email: emailInputSchema }),
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
      await authRateLimit(ip, '/auth/reset-password', { maxRequests: 10 });

      const userId = await consumePasswordResetToken(body.token);
      if (!userId) {
        throw new ApiError(400, 'Invalid or expired reset token', 'INVALID_TOKEN');
      }
      const passwordHash = await hashPassword(body.password);
      await setUserPassword(userId, passwordHash);

      reqLogger.info({ event: 'auth.password_reset', userId }, 'password reset');
      set.status = 200;
      return { message: 'Password updated. Sign in with your new password.' };
    },
    {
      body: t.Object({
        token: t.String({ minLength: 1, maxLength: MAX_AUTH_TOKEN_CHARS }),
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
  // GET /auth/apple/start — redirect to Apple authorization
  // -----------------------------------------------------------------------
  .get(
    '/apple/start',
    async ({ cookie, redirect, ip, request }) => {
      await authRateLimit(ip, '/auth/apple/start', { maxRequests: 30 });
      if (!isAppleConfigured()) {
        return redirect(socialCallbackUrl(request, 'apple', 'provider_not_configured'));
      }
      const state = generateRefreshToken();
      const nonce = generateRefreshToken();
      cookie[OAUTH_STATE_COOKIE]?.set({ value: state, ...stateCookieOptions('none') });
      cookie[OAUTH_NONCE_COOKIE]?.set({ value: nonce, ...stateCookieOptions('none') });
      return redirect(
        buildAppleAuthorizeUrl(state, `${getApiBaseUrl(request)}/api/auth/apple/callback`, nonce)
      );
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Start Sign in with Apple',
        description:
          'Redirects to Apple authorization (response_mode=form_post) and sets a short-lived CSRF state cookie.',
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/apple/callback — verify Apple ID token, issue session, redirect
  // -----------------------------------------------------------------------
  .post(
    '/apple/callback',
    async ({ jwt, body, cookie, redirect, request, reqLogger, ip }) => {
      await authRateLimit(ip, '/auth/apple/callback', { maxRequests: 30 });

      const stateCookie = cookie[OAUTH_STATE_COOKIE];
      const expectedState = typeof stateCookie?.value === 'string' ? stateCookie.value : undefined;
      removeStateCookie(stateCookie, 'none');
      const nonceCookie = cookie[OAUTH_NONCE_COOKIE];
      const expectedNonce = typeof nonceCookie?.value === 'string' ? nonceCookie.value : undefined;
      removeStateCookie(nonceCookie, 'none');

      const idToken = typeof body.id_token === 'string' ? body.id_token : undefined;
      const requestState = typeof body.state === 'string' ? body.state : undefined;
      const providerError = typeof body.error === 'string' ? body.error : undefined;

      if (providerError || !idToken || !requestState) {
        return redirect(socialCallbackUrl(request, 'apple', 'cancelled'));
      }
      if (!expectedState || expectedState !== requestState || !expectedNonce) {
        return redirect(socialCallbackUrl(request, 'apple', 'state_mismatch'));
      }

      let claims;
      try {
        claims = await verifyAppleIdToken(idToken, expectedNonce);
      } catch (e: unknown) {
        reqLogger.warn({ err: e }, 'apple: id_token verification failed');
        return redirect(socialCallbackUrl(request, 'apple', 'invalid_token'));
      }

      if (!claims.email) {
        return redirect(socialCallbackUrl(request, 'apple', 'email_required'));
      }

      try {
        const { user, isNewUser } = await findOrCreateUserByIdentity({
          provider: 'apple',
          providerAccountId: claims.sub,
          email: claims.email,
          emailVerified: claims.emailVerified,
          name: claims.name ?? parseAppleUserName(body.user),
        });
        if (isNewUser) {
          const deviceType = classifyDevice(request.headers.get('user-agent') ?? undefined);
          keepAlive(
            sendTelegramMessage(
              `New user: ${user.email} | apple/${deviceType} | ${new Date().toISOString()}`
            )
          );
        }
        await issueTokens(jwt, cookie, user);
        reqLogger.info({ event: 'auth.apple', userId: user.id }, 'apple sign-in');
        return redirect(socialCallbackUrl(request, 'apple'));
      } catch (e: unknown) {
        reqLogger.warn({ err: e }, 'apple: sign-in failed');
        return redirect(socialCallbackUrl(request, 'apple', identityErrorCode(e)));
      }
    },
    {
      body: t.Object({
        id_token: t.Optional(t.String({ maxLength: MAX_OAUTH_ID_TOKEN_CHARS })),
        state: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })),
        code: t.Optional(t.String({ maxLength: MAX_OAUTH_CODE_CHARS })),
        user: t.Optional(t.String({ maxLength: MAX_OAUTH_USER_CHARS })),
        error: t.Optional(t.String({ maxLength: MAX_OAUTH_ERROR_CHARS })),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Apple sign-in callback (form_post)',
        description:
          'Verifies the Apple ID token, links or creates the user, sets the refresh cookie, and redirects to the SPA callback.',
      },
    }
  )

  // -----------------------------------------------------------------------
  // GET /auth/github/start — redirect to GitHub authorization
  // -----------------------------------------------------------------------
  .get(
    '/github/start',
    async ({ cookie, redirect, ip, request }) => {
      await authRateLimit(ip, '/auth/github/start', { maxRequests: 30 });
      if (!isGitHubConfigured()) {
        return redirect(socialCallbackUrl(request, 'github', 'provider_not_configured'));
      }
      const state = generateRefreshToken();
      const verifier = generatePkceVerifier();
      const challenge = await pkceChallenge(verifier);
      cookie[OAUTH_STATE_COOKIE]?.set({ value: state, ...stateCookieOptions('lax') });
      cookie[OAUTH_PKCE_COOKIE]?.set({ value: verifier, ...stateCookieOptions('lax') });
      return redirect(
        buildGitHubAuthorizeUrl(
          state,
          `${getApiBaseUrl(request)}/api/auth/github/callback`,
          challenge
        )
      );
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Start GitHub sign-in',
        description:
          'Redirects to GitHub authorization and sets a short-lived CSRF state cookie (SameSite=Lax).',
      },
    }
  )

  // -----------------------------------------------------------------------
  // GET /auth/github/callback — exchange code, look up user, issue session
  // -----------------------------------------------------------------------
  .get(
    '/github/callback',
    async ({ jwt, query, cookie, redirect, request, reqLogger, ip }) => {
      await authRateLimit(ip, '/auth/github/callback', { maxRequests: 30 });

      const stateCookie = cookie[OAUTH_STATE_COOKIE];
      const expectedState = typeof stateCookie?.value === 'string' ? stateCookie.value : undefined;
      removeStateCookie(stateCookie, 'lax');
      const pkceCookie = cookie[OAUTH_PKCE_COOKIE];
      const codeVerifier = typeof pkceCookie?.value === 'string' ? pkceCookie.value : undefined;
      removeStateCookie(pkceCookie, 'lax');

      const code = typeof query.code === 'string' ? query.code : undefined;
      const requestState = typeof query.state === 'string' ? query.state : undefined;
      const providerError = typeof query.error === 'string' ? query.error : undefined;

      if (providerError || !code || !requestState) {
        return redirect(socialCallbackUrl(request, 'github', 'cancelled'));
      }
      if (!expectedState || expectedState !== requestState || !codeVerifier) {
        return redirect(socialCallbackUrl(request, 'github', 'state_mismatch'));
      }

      let identity;
      try {
        const redirectUri = `${getApiBaseUrl(request)}/api/auth/github/callback`;
        const accessToken = await exchangeGitHubCode(code, redirectUri, codeVerifier);
        identity = await fetchGitHubIdentity(accessToken);
      } catch (e: unknown) {
        reqLogger.warn({ err: e }, 'github: oauth exchange/lookup failed');
        const code =
          e instanceof ApiError && e.code === 'AUTH_EMAIL_UNVERIFIED'
            ? 'email_required'
            : 'provider_error';
        return redirect(socialCallbackUrl(request, 'github', code));
      }

      try {
        const { user, isNewUser } = await findOrCreateUserByIdentity({
          provider: 'github',
          providerAccountId: identity.id,
          email: identity.email,
          emailVerified: identity.emailVerified,
          name: identity.name,
        });
        if (isNewUser) {
          const deviceType = classifyDevice(request.headers.get('user-agent') ?? undefined);
          keepAlive(
            sendTelegramMessage(
              `New user: ${user.email} | github/${deviceType} | ${new Date().toISOString()}`
            )
          );
        }
        await issueTokens(jwt, cookie, user);
        reqLogger.info({ event: 'auth.github', userId: user.id }, 'github sign-in');
        return redirect(socialCallbackUrl(request, 'github'));
      } catch (e: unknown) {
        reqLogger.warn({ err: e }, 'github: sign-in failed');
        return redirect(socialCallbackUrl(request, 'github', identityErrorCode(e)));
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String({ maxLength: MAX_OAUTH_CODE_CHARS })),
        state: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })),
        error: t.Optional(t.String({ maxLength: MAX_OAUTH_ERROR_CHARS })),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'GitHub sign-in callback',
        description:
          'Exchanges the code, looks up the GitHub user + primary verified email, links or creates the user, sets the refresh cookie, and redirects to the SPA callback.',
      },
    }
  )

  // -----------------------------------------------------------------------
  // GET /auth/microsoft/start — redirect to Microsoft authorization
  // -----------------------------------------------------------------------
  .get(
    '/microsoft/start',
    async ({ cookie, redirect, ip, request }) => {
      await authRateLimit(ip, '/auth/microsoft/start', { maxRequests: 30 });
      if (!isMicrosoftConfigured()) {
        return redirect(socialCallbackUrl(request, 'microsoft', 'provider_not_configured'));
      }
      const state = generateRefreshToken();
      const nonce = generateRefreshToken();
      const verifier = generatePkceVerifier();
      const challenge = await pkceChallenge(verifier);
      cookie[OAUTH_STATE_COOKIE]?.set({ value: state, ...stateCookieOptions('lax') });
      cookie[OAUTH_NONCE_COOKIE]?.set({ value: nonce, ...stateCookieOptions('lax') });
      cookie[OAUTH_PKCE_COOKIE]?.set({ value: verifier, ...stateCookieOptions('lax') });
      return redirect(
        buildMicrosoftAuthorizeUrl(
          state,
          `${getApiBaseUrl(request)}/api/auth/microsoft/callback`,
          nonce,
          challenge
        )
      );
    },
    {
      detail: {
        tags: ['Auth'],
        summary: 'Start Microsoft sign-in',
        description:
          'Redirects to Microsoft authorization and sets short-lived CSRF, nonce, and PKCE cookies.',
      },
    }
  )

  // -----------------------------------------------------------------------
  // GET /auth/microsoft/callback — exchange code, verify ID token, issue session
  // -----------------------------------------------------------------------
  .get(
    '/microsoft/callback',
    async ({ jwt, query, cookie, redirect, request, reqLogger, ip }) => {
      await authRateLimit(ip, '/auth/microsoft/callback', { maxRequests: 30 });

      const stateCookie = cookie[OAUTH_STATE_COOKIE];
      const expectedState = typeof stateCookie?.value === 'string' ? stateCookie.value : undefined;
      removeStateCookie(stateCookie, 'lax');
      const nonceCookie = cookie[OAUTH_NONCE_COOKIE];
      const expectedNonce = typeof nonceCookie?.value === 'string' ? nonceCookie.value : undefined;
      removeStateCookie(nonceCookie, 'lax');
      const pkceCookie = cookie[OAUTH_PKCE_COOKIE];
      const codeVerifier = typeof pkceCookie?.value === 'string' ? pkceCookie.value : undefined;
      removeStateCookie(pkceCookie, 'lax');

      const code = typeof query.code === 'string' ? query.code : undefined;
      const requestState = typeof query.state === 'string' ? query.state : undefined;
      const providerError = typeof query.error === 'string' ? query.error : undefined;

      if (providerError || !code || !requestState) {
        return redirect(socialCallbackUrl(request, 'microsoft', 'cancelled'));
      }
      if (!expectedState || expectedState !== requestState || !expectedNonce || !codeVerifier) {
        return redirect(socialCallbackUrl(request, 'microsoft', 'state_mismatch'));
      }

      let identity;
      try {
        const redirectUri = `${getApiBaseUrl(request)}/api/auth/microsoft/callback`;
        const tokenSet = await exchangeMicrosoftCode(code, redirectUri, codeVerifier);
        identity = await fetchMicrosoftIdentity(
          tokenSet.idToken,
          tokenSet.accessToken,
          expectedNonce
        );
      } catch (e: unknown) {
        reqLogger.warn({ err: e }, 'microsoft: oauth exchange/lookup failed');
        const code =
          e instanceof ApiError && e.code === 'AUTH_EMAIL_UNVERIFIED'
            ? 'email_required'
            : 'provider_error';
        return redirect(socialCallbackUrl(request, 'microsoft', code));
      }

      try {
        const { user, isNewUser } = await findOrCreateUserByIdentity({
          provider: 'microsoft',
          providerAccountId: identity.id,
          email: identity.email,
          emailVerified: identity.emailVerified,
          name: identity.name,
        });
        if (isNewUser) {
          const deviceType = classifyDevice(request.headers.get('user-agent') ?? undefined);
          keepAlive(
            sendTelegramMessage(
              `New user: ${user.email} | microsoft/${deviceType} | ${new Date().toISOString()}`
            )
          );
        }
        await issueTokens(jwt, cookie, user);
        reqLogger.info({ event: 'auth.microsoft', userId: user.id }, 'microsoft sign-in');
        return redirect(socialCallbackUrl(request, 'microsoft'));
      } catch (e: unknown) {
        reqLogger.warn({ err: e }, 'microsoft: sign-in failed');
        return redirect(socialCallbackUrl(request, 'microsoft', identityErrorCode(e)));
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String({ maxLength: MAX_OAUTH_CODE_CHARS })),
        state: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })),
        error: t.Optional(t.String({ maxLength: MAX_OAUTH_ERROR_CHARS })),
      }),
      detail: {
        tags: ['Auth'],
        summary: 'Microsoft sign-in callback',
        description:
          'Exchanges the code, verifies the Microsoft ID token, links or creates the user, sets the refresh cookie, and redirects to the SPA callback.',
      },
    }
  )

  // -----------------------------------------------------------------------
  // POST /auth/dev — dev-only sign-in for E2E tests.
  // Only registered when AUTH_DEV_ROUTE_ENABLED=true and NODE_ENV != production.
  // -----------------------------------------------------------------------
  .use((app) =>
    DEV_AUTH_ENABLED
      ? app
          .post(
            '/dev',
            async ({ jwt, body, cookie, set, ip, headers }) => {
              await authRateLimit(ip, 'POST /auth/dev', DEV_AUTH_RATE_LIMIT);
              if (!devAuthSecretMatches(headers['x-dev-auth-secret'])) {
                throw new ApiError(401, 'Invalid dev auth secret', 'UNAUTHORIZED');
              }
              // Reuse existing user by email (dev logins generate a new googleId each time,
              // which would violate the email unique constraint on repeated calls).
              const existing = await findUserByEmail(body.email);
              const user = existing
                ? existing
                : (
                    await findOrCreateGoogleUser(
                      `dev-${crypto.randomUUID()}`,
                      body.email,
                      undefined
                    )
                  ).user;
              const { accessToken } = await issueTokens(jwt, cookie, user);
              set.status = 201;
              return { user: userResponse(user), accessToken };
            },
            {
              body: t.Object({
                email: emailInputSchema,
              }),
              detail: { tags: ['Auth'], summary: 'Dev-only test sign-in (404 in production)' },
            }
          )
          .post(
            '/dev/password-user',
            async ({ body, set, ip, headers }) => {
              await authRateLimit(ip, 'POST /auth/dev/password-user', DEV_AUTH_RATE_LIMIT);
              if (!devAuthSecretMatches(headers['x-dev-auth-secret'])) {
                throw new ApiError(401, 'Invalid dev auth secret', 'UNAUTHORIZED');
              }

              const passwordHash = await hashPassword(body.password);
              const existing = await findUserByEmail(body.email);
              const user = existing
                ? existing
                : await createPasswordUser({
                    email: body.email,
                    passwordHash,
                    name: body.name,
                  });

              if (existing) {
                await setUserPassword(existing.id, passwordHash);
              }
              const verified = await markEmailVerified(user.id);
              if (!verified) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

              set.status = 201;
              return { user: userResponse(verified) };
            },
            {
              body: t.Object({
                email: emailInputSchema,
                password: t.String({ minLength: 8, maxLength: 200 }),
                name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
              }),
              detail: {
                tags: ['Auth'],
                summary: 'Dev-only verified password-user seed (404 in production)',
              },
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
      await authRateLimit(ip, '/auth/refresh', IS_PRODUCTION ? undefined : { maxRequests: 500 });

      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      const tokenValue = refreshCookie?.value;

      if (!tokenValue || typeof tokenValue !== 'string') {
        throw new ApiError(401, 'No refresh token', 'AUTH_NO_REFRESH_TOKEN');
      }

      const refreshed = await refreshAuthToken(jwt, reqLogger, tokenValue, () => {
        removeRefreshCookie(refreshCookie);
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
      await authRateLimit(
        ip,
        '/auth/mobile/refresh',
        IS_PRODUCTION ? undefined : { maxRequests: 500 }
      );

      if (!body.refreshToken || body.refreshToken.length === 0) {
        throw new ApiError(401, 'No refresh token', 'AUTH_NO_REFRESH_TOKEN');
      }

      const refreshed = await refreshAuthToken(jwt, reqLogger, body.refreshToken);
      return refreshed;
    },
    {
      body: t.Object({ refreshToken: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })) }),
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
    async ({ cookie, reqLogger, ip }) => {
      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      try {
        await rateLimit(ip, '/auth/signout');
        await signOutWithRefreshToken(refreshCookie?.value);

        reqLogger.info({ event: 'auth.signout' }, 'user signed out');
        // Body-less 204: Node's undici rejects a non-null body with status 204
        // (Bun tolerated it). The refresh-cookie clear below is still serialized
        // onto this Response by Elysia.
        return new Response(null, { status: 204 });
      } finally {
        // Expire the browser credential even when rate limiting or storage
        // fails. The client still reports the error, but a reload cannot reuse
        // a cookie that the server was able to answer for.
        if (refreshCookie) removeRefreshCookie(refreshCookie);
      }
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
    async ({ body, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/mobile/signout');

      await signOutWithRefreshToken(body.refreshToken);

      reqLogger.info({ event: 'auth.mobile_signout' }, 'mobile user signed out');
      // Return an explicit body-less 204. Node's undici Response constructor
      // rejects a non-null body with status 204 (Bun tolerated it), and Elysia
      // maps an empty handler return to an empty-string body — so we build the
      // response directly to stay runtime-agnostic.
      return new Response(null, { status: 204 });
    },
    {
      body: t.Object({ refreshToken: t.Optional(t.String({ maxLength: MAX_AUTH_TOKEN_CHARS })) }),
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
        const dataUrlMatch = DATA_URL_IMAGE_RE.exec(body.avatarUrl);
        if (!dataUrlMatch) {
          throw new ApiError(
            400,
            'Avatar must be a base64 data URL (JPEG, PNG, or WebP)',
            'INVALID_AVATAR'
          );
        }
        const declaredType = dataUrlMatch[1];
        if (body.avatarUrl.length > MAX_AVATAR_BYTES) {
          throw new ApiError(400, 'Avatar exceeds maximum size (200KB)', 'AVATAR_TOO_LARGE');
        }
        // Validate base64 roundtrip to reject corrupted/malformed payloads
        const b64Part = body.avatarUrl.split(',')[1];
        if (!b64Part || b64Part.length === 0) {
          throw new ApiError(400, 'Empty avatar data', 'INVALID_AVATAR');
        }
        let decoded: Buffer;
        try {
          decoded = Buffer.from(b64Part, 'base64');
          if (decoded.toString('base64') !== b64Part) {
            throw new ApiError(400, 'Invalid base64 in avatar', 'INVALID_AVATAR');
          }
        } catch (e: unknown) {
          if (e instanceof ApiError) throw e;
          throw new ApiError(400, 'Invalid base64 in avatar', 'INVALID_AVATAR');
        }
        // Confirm the decoded bytes are actually an image of the declared type,
        // not arbitrary data smuggled under an image/* label.
        if (declaredType === undefined || !avatarSignatureMatches(declaredType, decoded)) {
          throw new ApiError(
            400,
            'Avatar data is not a valid image of the declared type',
            'INVALID_AVATAR'
          );
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
        avatarUrl: t.Optional(t.Nullable(t.String({ maxLength: MAX_AVATAR_BYTES }))),
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
    async ({ userId, cookie, reqLogger, ip }) => {
      await rateLimit(ip, '/auth/me/delete', { maxRequests: 5 });

      await softDeleteUser(userId);

      // Clear the refresh cookie
      const refreshCookie = cookie[REFRESH_COOKIE_NAME];
      if (refreshCookie) removeRefreshCookie(refreshCookie);

      reqLogger.info({ event: 'auth.account_deleted', userId }, 'account soft-deleted');
      // Body-less 204 for Node/undici compatibility; the refresh-cookie clear
      // above is still serialized onto this Response by Elysia.
      return new Response(null, { status: 204 });
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
