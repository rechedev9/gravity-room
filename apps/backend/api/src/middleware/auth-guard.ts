/**
 * Auth guard — JWT verification for protected routes.
 *
 * Exports:
 * - `jwtPlugin` - Elysia plugin that adds `jwt.sign()` and `jwt.verify()` to context
 * - `verifyAccessToken()` - Shared trust pipeline (signature verify with the algorithm
 *   pinned to HS256, then issuer/audience/subject, active-user reload, and session-version
 *   checks) for an already-extracted Bearer token
 * - `resolveUserId()` - Required-auth resolver: extracts the Bearer token then runs
 *   `verifyAccessToken`. Optional-auth callers (e.g. the exercise routes) reuse
 *   `verifyAccessToken` directly so both paths share one validation sequence.
 *
 * Routes that need auth should: `.use(jwtPlugin).resolve(resolveUserId)`
 * This pattern ensures TypeScript correctly infers `userId` in the handler context.
 */
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { ApiError } from './error-handler';
import { logger } from '../lib/logger';
import { getRedis } from '../lib/redis';
import { trackPresence } from '../lib/presence';
import { keepAlive } from '../lib/wait-until';
import { findUserById } from '../services/auth';

const BEARER_PREFIX = 'Bearer ';
const TEST_SECRET = 'test-secret-do-not-use-outside-tests';

const isProduction = process.env['NODE_ENV'] === 'production';
const isTest = process.env['NODE_ENV'] === 'test';
const secret = process.env['JWT_SECRET'];

if (!secret && !isTest) {
  throw new Error(
    'JWT_SECRET env var must be set (only NODE_ENV=test allows the built-in fallback)'
  );
}
const minLen = isProduction ? 64 : 32;
if (secret && secret.length < minLen) {
  throw new Error(`JWT_SECRET must be at least ${minLen} characters (got ${secret.length})`);
}
if (!secret) {
  logger.warn('JWT_SECRET not set — using test-only fallback (NODE_ENV=test).');
}
const JWT_SECRET = secret ?? TEST_SECRET;

export const JWT_ISSUER = 'gravity-room-api';
export const JWT_AUDIENCE = 'gravity-room-clients';

export const jwtPlugin = new Elysia({ name: 'jwt-plugin' }).use(
  jwt({
    name: 'jwt',
    secret: JWT_SECRET,
    alg: 'HS256',
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
  })
);

export function extractBearerToken(headers: Record<string, string | undefined>): string {
  const authorization = headers['authorization'];
  if (!authorization?.startsWith(BEARER_PREFIX)) {
    throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
  }

  const token = authorization.slice(BEARER_PREFIX.length);
  if (!token) {
    throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
  }

  return token;
}

/**
 * The only JWS algorithm this API issues (`jwtPlugin` signs with `alg: 'HS256'`).
 * Passing it to `verify` pins jose to HS256: the symmetric secret already restricts
 * jose to HS* today, but stating the allow-list explicitly rejects `alg: none` and
 * asymmetric-algorithm downgrade tokens even if the key type ever changes.
 */
const ACCEPTED_JWT_ALGORITHMS: string[] = ['HS256'];

/**
 * Minimal shape of the JWT verifier this module depends on. It mirrors the `verify`
 * decorator that `@elysiajs/jwt` adds to the Elysia context, whose second argument is
 * forwarded straight to jose's `jwtVerify`, which is how we pin the accepted
 * algorithm(s).
 */
export interface JwtVerifier {
  verify: (
    token?: string,
    options?: { algorithms?: string[] }
  ) => Promise<Record<string, unknown> | false>;
}

/**
 * Single trust pipeline shared by required auth (`resolveUserId`) and optional auth
 * (`resolveOptionalUserId` in the exercise routes). Given an already-extracted Bearer
 * token it: verifies the signature with the algorithm pinned to HS256, then checks
 * issuer, audience, and subject type, reloads the still-active user (soft-deleted users
 * are filtered out by `findUserById`), and confirms the token's embedded session version
 * still matches. Callers own the missing-Authorization-header policy (required → 401,
 * optional → anonymous) before calling this.
 *
 * @throws {ApiError} 401 on any verification or authorization failure.
 */
export async function verifyAccessToken(
  jwtCtx: JwtVerifier,
  token: string
): Promise<{ userId: string }> {
  const payload = await jwtCtx.verify(token, { algorithms: ACCEPTED_JWT_ALGORITHMS });

  if (!payload) {
    throw new ApiError(401, 'Invalid or expired token', 'TOKEN_INVALID');
  }

  if (payload['iss'] !== JWT_ISSUER) {
    throw new ApiError(401, 'Invalid token issuer', 'TOKEN_INVALID');
  }

  const aud = payload['aud'];
  const audMatches = Array.isArray(aud) ? aud.includes(JWT_AUDIENCE) : aud === JWT_AUDIENCE;
  if (!audMatches) {
    throw new ApiError(401, 'Invalid token audience', 'TOKEN_INVALID');
  }

  const userId = payload['sub'];
  if (typeof userId !== 'string') {
    throw new ApiError(401, 'Invalid token payload', 'TOKEN_INVALID');
  }

  const user = await findUserById(userId);
  if (!user || user.deletedAt) {
    throw new ApiError(401, 'Token user is no longer active', 'TOKEN_USER_INACTIVE');
  }
  const authVersion = payload['av'];
  if (!Number.isInteger(authVersion) || authVersion !== user.authVersion) {
    throw new ApiError(401, 'Token session has been revoked', 'TOKEN_REVOKED');
  }

  return { userId };
}

/**
 * Resolve function for protected routes.
 * Verifies the Bearer token and returns `{ userId }` to be merged into context.
 */
export async function resolveUserId({
  jwt: jwtCtx,
  headers,
}: {
  jwt: JwtVerifier;
  headers: Record<string, string | undefined>;
}): Promise<{ userId: string }> {
  const token = extractBearerToken(headers);
  const { userId } = await verifyAccessToken(jwtCtx, token);

  const redis = getRedis();
  if (redis) {
    // Best-effort presence heartbeat. On Vercel the function may freeze the
    // instant the Response is returned, so hand the write to keepAlive() to
    // extend the lifetime until it settles instead of fire-and-forget.
    keepAlive(trackPresence(userId, redis));
  }

  return { userId };
}
