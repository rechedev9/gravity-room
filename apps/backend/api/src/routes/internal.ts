/**
 * Internal cron routes.
 *
 * These power Vercel Cron jobs and are NOT behind the normal user JWT auth.
 * Every route is guarded by a shared secret presented as `Authorization: Bearer
 * <secret>` or `x-internal-secret: <secret>`. Two secrets are accepted:
 *   - `INTERNAL_SECRET` — used by operators invoking these routes manually.
 *   - `CRON_SECRET`     — injected automatically by Vercel Cron. Cron jobs cannot
 *     set arbitrary request headers, but when a `CRON_SECRET` env var is present
 *     Vercel sends `Authorization: Bearer <CRON_SECRET>` on every cron invocation.
 *     Accepting it here lets the scheduled requests authenticate without weakening
 *     or replacing the manual `INTERNAL_SECRET` path.
 * The guard fails closed: if neither secret is configured every request is
 * rejected with 401, so an un-provisioned deploy never exposes these endpoints.
 *
 * Each route answers BOTH GET and POST. Vercel Cron always issues a GET request,
 * while operators may POST manually; both methods run behind the same guard.
 *
 * Mounted under the `/api` prefix in create-app.ts, giving:
 *   GET|POST /api/internal/cleanup-tokens
 *   GET|POST /api/internal/purge-users
 *   GET|POST /api/internal/analytics/compute
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
 *
 * Accepts a match against either `INTERNAL_SECRET` (manual ops) or `CRON_SECRET`
 * (auto-injected by Vercel Cron as `Authorization: Bearer <CRON_SECRET>`). Fails
 * closed when neither secret is configured.
 */
function assertInternalSecret(headers: Headers): void {
  const internalSecret = process.env['INTERNAL_SECRET'];
  const cronSecret = process.env['CRON_SECRET'];
  if (!internalSecret && !cronSecret) {
    logger.error(
      'internal route rejected: neither INTERNAL_SECRET nor CRON_SECRET is configured (fail closed)'
    );
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
  const presented = extractPresentedSecret(headers);
  const matches =
    presented !== undefined &&
    ((internalSecret !== undefined && safeEqual(presented, internalSecret)) ||
      (cronSecret !== undefined && safeEqual(presented, cronSecret)));
  if (!matches) {
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
}

/** Resolve the analytics batch size from the environment, clamped to >= 1. */
function resolveBatchSize(): number {
  const raw = Number(process.env['ANALYTICS_BATCH_SIZE']);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_ANALYTICS_BATCH_SIZE;
  return Math.floor(raw);
}

// ---------------------------------------------------------------------------
// Handlers — shared by the GET (Vercel Cron) and POST (manual ops) registrations
// ---------------------------------------------------------------------------

async function cleanupTokensHandler(): Promise<{ deleted: number }> {
  const deleted = await cleanupExpiredTokens();
  logger.info({ deleted }, 'internal: cleaned up expired refresh tokens');
  return { deleted };
}

async function purgeUsersHandler(): ReturnType<typeof purgeDeletedUsers> {
  return purgeDeletedUsers();
}

async function analyticsComputeHandler(): Promise<{
  processed: number;
  errors: number;
  batchSize: number;
}> {
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
}

export const internalRoutes = new Elysia({ prefix: '/internal' })
  .onBeforeHandle(({ request }) => {
    assertInternalSecret(request.headers);
  })
  // Vercel Cron invokes these with GET; operators may also POST manually.
  .get('/cleanup-tokens', cleanupTokensHandler)
  .post('/cleanup-tokens', cleanupTokensHandler)
  .get('/purge-users', purgeUsersHandler)
  .post('/purge-users', purgeUsersHandler)
  .get('/analytics/compute', analyticsComputeHandler)
  .post('/analytics/compute', analyticsComputeHandler);
