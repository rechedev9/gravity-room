/**
 * Internal cron routes.
 *
 * These power Vercel Cron jobs and are NOT behind the normal user JWT auth.
 * Every route is guarded by a shared `INTERNAL_SECRET` presented in an
 * `Authorization: Bearer <secret>` or `x-internal-secret` header. The guard
 * fails closed: if `INTERNAL_SECRET` is unset (always so in production, but
 * enforced everywhere here) every request is rejected with 401, so an
 * un-provisioned deploy never exposes these endpoints.
 *
 * Mounted under the `/api` prefix in create-app.ts, giving:
 *   POST /api/internal/cleanup-tokens
 *   POST /api/internal/purge-users
 *   POST /api/internal/analytics/compute
 */
import { Elysia } from 'elysia';
import { ApiError } from '../middleware/error-handler';
import { logger } from '../lib/logger';
import { cleanupExpiredTokens } from '../services/auth';
import { purgeDeletedUsers } from '../services/purge';
import { computeUser } from '../analytics/compute';
import { fetchLeastRecentlyComputedUsers } from '../analytics/queries';

/** Default cron batch size when ANALYTICS_BATCH_SIZE is unset/invalid. */
const DEFAULT_ANALYTICS_BATCH_SIZE = 50;

/** Constant-time string comparison to avoid leaking the secret via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Extract the presented secret from the Authorization or x-internal-secret header. */
function extractPresentedSecret(headers: Headers): string | undefined {
  const auth = headers.get('authorization');
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match?.[1]) return match[1];
  }
  return headers.get('x-internal-secret') ?? undefined;
}

/**
 * Throws 401 unless a correctly-configured secret is presented. Reads the env at
 * call time (not import time) so deploys and tests pick up the current value.
 */
function assertInternalSecret(headers: Headers): void {
  const configured = process.env['INTERNAL_SECRET'];
  if (!configured) {
    logger.error('internal route rejected: INTERNAL_SECRET is not configured (fail closed)');
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
  const presented = extractPresentedSecret(headers);
  if (!presented || !safeEqual(presented, configured)) {
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
}

/** Resolve the analytics batch size from the environment, clamped to >= 1. */
function resolveBatchSize(): number {
  const raw = Number(process.env['ANALYTICS_BATCH_SIZE']);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_ANALYTICS_BATCH_SIZE;
  return Math.floor(raw);
}

export const internalRoutes = new Elysia({ prefix: '/internal' })
  .onBeforeHandle(({ request }) => {
    assertInternalSecret(request.headers);
  })
  .post('/cleanup-tokens', async () => {
    const deleted = await cleanupExpiredTokens();
    logger.info({ deleted }, 'internal: cleaned up expired refresh tokens');
    return { deleted };
  })
  .post('/purge-users', async () => {
    const summary = await purgeDeletedUsers();
    return summary;
  })
  .post('/analytics/compute', async () => {
    const batchSize = resolveBatchSize();
    const users = await fetchLeastRecentlyComputedUsers(batchSize);

    let processed = 0;
    let errors = 0;
    for (const user of users) {
      try {
        await computeUser(user.userId);
        processed += 1;
      } catch (error) {
        logger.error({ err: error, userId: user.userId }, 'internal: analytics compute failed');
        errors += 1;
      }
    }

    logger.info({ processed, errors, batchSize }, 'internal: analytics compute batch done');
    return { processed, errors, batchSize };
  });
