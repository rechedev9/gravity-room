/**
 * Internal cron routes.
 *
 * These power Vercel Cron jobs and are NOT behind the normal user JWT auth.
 * Every route is guarded by a shared secret presented as `Authorization: Bearer
 * <secret>` or `x-internal-secret: <secret>`. Secrets are scoped:
 *   - `INTERNAL_SECRET` — operators (all internal routes) and manual cron invokes.
 *   - `CRON_SECRET`     — only the Vercel-scheduled routes (`/maintenance`,
 *     `/analytics/compute`). Injected as `Authorization: Bearer <CRON_SECRET>`.
 *     A leaked cron credential must not unlock readiness/purge standalone ops.
 * The guard fails closed: missing required secrets reject with 401.
 *
 * Maintenance operations answer BOTH GET and POST. Vercel Cron always issues a
 * GET request, while operators may POST manually. The deep readiness probe is
 * GET-only. Every method runs behind the same guard and shared attempt budget.
 *
 * Mounted under the `/api` prefix in create-app.ts, giving:
 *   GET      /api/internal/readiness
 *   GET|POST /api/internal/cleanup-tokens
 *   GET|POST /api/internal/purge-users
 *   GET|POST /api/internal/analytics/compute
 *   GET|POST /api/internal/maintenance        (cleanup-tokens + purge-users)
 *
 * Scheduling note: only `analytics/compute` and `maintenance` are wired to Vercel
 * Cron (see `vercel.json`). The Vercel Hobby plan allows at most two cron jobs,
 * each running once per day, so the two daily maintenance jobs (token cleanup and
 * the soft-deleted-user purge) are folded into the single `maintenance` route to
 * fit one slot, leaving the other for analytics. The standalone `cleanup-tokens`
 * and `purge-users` routes are retained for manual operator invocation.
 */
import { Elysia } from 'elysia';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../middleware/error-handler';
import { logger } from '../lib/logger';
import { checkReadiness } from '../lib/readiness';
import { rateLimit } from '../middleware/rate-limit';
import { requestLogger } from '../middleware/request-logger';
import { DEFAULT_ANALYTICS_BATCH_SIZE, MAX_ANALYTICS_BATCH_SIZE } from '../lib/env-validation';
import { cleanupExpiredTokens } from '../services/auth';
import { purgeDeletedUsers } from '../services/purge';
import { computeUser } from '../analytics/compute';
import { fetchLeastRecentlyComputedUsers } from '../analytics/queries';

/** One shared attempt budget protects every internal operation and its secret guard. */
const INTERNAL_RATE_LIMIT = { windowMs: 60_000, maxRequests: 30, failClosed: true } as const;

/**
 * Constant-time string comparison that avoids leaking the secret via timing.
 *
 * Both inputs are first hashed with SHA-256, yielding two fixed-length (32-byte)
 * digests. `timingSafeEqual` therefore always compares equal-length buffers and
 * runs in constant time regardless of the inputs' lengths, closing the length
 * side-channel a raw byte-by-byte compare leaks when it must bail out early on a
 * length mismatch.
 */
function safeEqual(a: string, b: string): boolean {
  const aDigest = createHash('sha256').update(a, 'utf8').digest();
  const bDigest = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(aDigest, bDigest);
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
 * Which secrets may unlock a given internal route.
 *
 * - `internal` — operator-only (readiness probe, standalone cleanup/purge).
 * - `cron`     — Vercel Cron injects CRON_SECRET; also accepted on the two
 *                scheduled routes so ops can still invoke them manually with
 *                INTERNAL_SECRET.
 *
 * CRON_SECRET must not unlock operator-only routes: a leaked cron credential
 * would otherwise grant purge/readiness beyond the scheduled surface.
 */
type InternalSecretScope = 'internal' | 'cron';

const CRON_SCOPED_PATHS = new Set(['/analytics/compute', '/maintenance']);

function secretScopeForPath(pathname: string): InternalSecretScope {
  // pathname is the route path under the /internal prefix (e.g. "/maintenance").
  for (const suffix of CRON_SCOPED_PATHS) {
    if (pathname === suffix || pathname.endsWith(suffix)) return 'cron';
  }
  return 'internal';
}

/**
 * Throws 401 unless a correctly-configured secret is presented. Reads the env at
 * call time (not import time) so deploys and tests pick up the current value.
 *
 * Scope:
 * - cron routes accept INTERNAL_SECRET or CRON_SECRET
 * - operator-only routes accept INTERNAL_SECRET only
 * Fails closed when the required secret(s) are unset.
 */
function assertInternalSecret(headers: Headers, scope: InternalSecretScope): void {
  // An empty or whitespace-only env value counts as NOT configured: it would
  // otherwise be a trivially-guessable secret, so fold it into the fail-closed
  // branch.
  const internalSecret = normalizeSecret(process.env['INTERNAL_SECRET']);
  const cronSecret = normalizeSecret(process.env['CRON_SECRET']);

  if (scope === 'cron') {
    if (!internalSecret && !cronSecret) {
      logger.error(
        'internal route rejected: neither INTERNAL_SECRET nor CRON_SECRET is configured (fail closed)'
      );
      throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
    }
  } else if (!internalSecret) {
    logger.error('internal route rejected: INTERNAL_SECRET is not configured (fail closed)');
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  const presented = extractPresentedSecret(headers);
  // Reject an empty presented secret before the constant-time compare.
  const matches =
    presented !== undefined &&
    presented.length > 0 &&
    ((internalSecret !== undefined && safeEqual(presented, internalSecret)) ||
      (scope === 'cron' && cronSecret !== undefined && safeEqual(presented, cronSecret)));
  if (!matches) {
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }
}

/** Treat empty/whitespace-only secrets as unset (returns undefined). */
function normalizeSecret(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return raw.trim().length > 0 ? raw : undefined;
}

/** Resolve the analytics batch size defensively even outside production validation. */
export function resolveBatchSize(): number {
  const raw = Number(process.env['ANALYTICS_BATCH_SIZE']);
  if (!Number.isInteger(raw) || raw < 1) return DEFAULT_ANALYTICS_BATCH_SIZE;
  return Math.min(raw, MAX_ANALYTICS_BATCH_SIZE);
}

// ---------------------------------------------------------------------------
// Handlers — shared by the GET (Vercel Cron) and POST (manual ops) registrations
// ---------------------------------------------------------------------------

async function readinessHandler(): Promise<Awaited<ReturnType<typeof checkReadiness>>> {
  const result = await checkReadiness();
  if (result.status !== 'ready') {
    throw new ApiError(503, 'Service dependencies are unavailable', 'NOT_READY');
  }
  return result;
}

async function cleanupTokensHandler(): Promise<{ deleted: number }> {
  const deleted = await cleanupExpiredTokens();
  logger.info({ deleted }, 'internal: cleaned up expired authentication tokens');
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

/**
 * Daily maintenance: runs the expired-token cleanup and the soft-deleted-user
 * purge in one pass. Consolidated into a single endpoint so both jobs share one
 * Vercel Cron slot (the Hobby plan allows only two daily crons; analytics/compute
 * takes the other). The jobs touch independent tables and start together so a
 * slow cleanup cannot prevent the purge from running before the function timeout.
 */
async function maintenanceHandler(): Promise<{
  tokens: Awaited<ReturnType<typeof cleanupTokensHandler>>;
  users: Awaited<ReturnType<typeof purgeUsersHandler>>;
}> {
  const [tokens, users] = await Promise.all([cleanupTokensHandler(), purgeUsersHandler()]);
  logger.info({ tokens, users }, 'internal: daily maintenance done');
  return { tokens, users };
}

export const internalRoutes = new Elysia({ prefix: '/internal' })
  .use(requestLogger)
  .onBeforeHandle(async ({ request, ip }) => {
    // Throttle before comparing the secret so online guessing and log flooding
    // are bounded. Internal operations fail closed when the distributed limiter
    // is unavailable in production.
    await rateLimit(ip, 'INTERNAL /api/internal/*', INTERNAL_RATE_LIMIT);
    const pathname = new URL(request.url, 'http://localhost').pathname;
    // Strip the mount prefix if present (plugin prefix is /internal).
    const scopedPath = pathname.replace(/^\/internal/, '') || pathname;
    assertInternalSecret(request.headers, secretScopeForPath(scopedPath));
  })
  // Vercel Cron invokes these with GET; operators may also POST manually.
  .get('/readiness', readinessHandler)
  .get('/cleanup-tokens', cleanupTokensHandler)
  .post('/cleanup-tokens', cleanupTokensHandler)
  .get('/purge-users', purgeUsersHandler)
  .post('/purge-users', purgeUsersHandler)
  .get('/analytics/compute', analyticsComputeHandler)
  .post('/analytics/compute', analyticsComputeHandler)
  .get('/maintenance', maintenanceHandler)
  .post('/maintenance', maintenanceHandler);
