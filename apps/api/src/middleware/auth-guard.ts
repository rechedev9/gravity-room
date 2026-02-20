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

const rawSecret = process.env['JWT_SECRET'];
if (!rawSecret) {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_SECRET env var must be set in production');
  }
  logger.warn('JWT_SECRET not set — using insecure default. Set it in .env.local');
}
if (process.env['NODE_ENV'] === 'production') {
  if (rawSecret === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET must not use the default dev value in production');
  }
  if ((rawSecret ?? '').length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters in production');
  }
}
const JWT_SECRET = rawSecret ?? 'dev-secret-change-me';

export const jwtPlugin = new Elysia({ name: 'jwt-plugin' }).use(
  jwt({
    name: 'jwt',
    secret: JWT_SECRET,
  })
);

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
  const authorization = headers['authorization'];
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
  }

  const token = authorization.slice(7);
  if (!token) {
    throw new ApiError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED');
  }
  const payload = await jwtCtx.verify(token);

  if (!payload) {
    throw new ApiError(401, 'Invalid or expired token', 'TOKEN_INVALID');
  }

  const userId = payload['sub'];
  if (typeof userId !== 'string') {
    throw new ApiError(401, 'Invalid token payload', 'TOKEN_INVALID');
  }

  return { userId };
}
