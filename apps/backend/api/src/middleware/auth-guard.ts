/**
 * Auth guard — JWT verification for protected routes.
 *
 * Two exports:
 * - `jwtPlugin` — Elysia plugin that adds `jwt.sign()` and `jwt.verify()` to context
 * - `resolveUserId()` — Standalone function that extracts userId from JWT in auth header
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
 * Resolve function for protected routes.
 * Verifies the Bearer token and returns `{ userId }` to be merged into context.
 */
export async function resolveUserId({
  jwt: jwtCtx,
  headers,
}: {
  jwt: { verify: (token?: string) => Promise<Record<string, unknown> | false> };
  headers: Record<string, string | undefined>;
}): Promise<{ userId: string }> {
  const token = extractBearerToken(headers);
  const payload = await jwtCtx.verify(token);

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
  if (!user) {
    throw new ApiError(401, 'Token user is no longer active', 'TOKEN_USER_INACTIVE');
  }

  const redis = getRedis();
  if (redis) {
    void trackPresence(userId, redis).catch((err: unknown) => {
      logger.warn({ err }, 'presence track failed');
    });
  }

  return { userId };
}
