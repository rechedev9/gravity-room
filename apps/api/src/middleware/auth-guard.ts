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

const BEARER_PREFIX = 'Bearer ';
const DEV_SECRET = 'dev-secret-change-me';

const rawSecret = process.env['JWT_SECRET'];
if (!rawSecret) {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_SECRET env var must be set in production');
  }
  logger.warn('JWT_SECRET not set — using insecure default. Set it in .env.local');
}
if (process.env['NODE_ENV'] === 'production') {
  if (rawSecret === DEV_SECRET) {
    throw new Error('JWT_SECRET must not use the default dev value in production');
  }
  if ((rawSecret ?? '').length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters in production');
  }
}
const JWT_SECRET = rawSecret ?? DEV_SECRET;

export const jwtPlugin = new Elysia({ name: 'jwt-plugin' }).use(
  jwt({
    name: 'jwt',
    secret: JWT_SECRET,
  })
);

function extractBearerToken(headers: Record<string, string | undefined>): string {
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

  const userId = payload['sub'];
  if (typeof userId !== 'string') {
    throw new ApiError(401, 'Invalid token payload', 'TOKEN_INVALID');
  }

  const redis = getRedis();
  if (redis) {
    void trackPresence(userId, redis).catch((err: unknown) => {
      logger.warn({ err }, 'presence track failed');
    });
  }

  return { userId };
}
