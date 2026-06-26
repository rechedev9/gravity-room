import { captureException, flushSentry } from './lib/sentry';
import { keepAlive } from './lib/wait-until';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { sql } from 'drizzle-orm';
import { ApiError } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { swaggerPlugin } from './plugins/swagger';
import { authRoutes } from './routes/auth';
import { programRoutes } from './routes/programs';
import { catalogRoutes } from './routes/catalog';
import { exerciseRoutes } from './routes/exercises';
import { resultRoutes } from './routes/results';
import { statsRoutes } from './routes/stats';
import { insightsRoutes } from './routes/insights';
import { internalRoutes } from './routes/internal';
import { getDb } from './db';
import { getRedis } from './lib/redis';
import { logger } from './lib/logger';
import { formatValidationError, validateEnv } from './lib/env-validation';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type CreateAppOptions = {
  corsOrigins: string | string[];
  csp: string;
  permissionsPolicy: string;
};

function shouldDisableHttpCache(request: Request): boolean {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/auth/')) return true;
  if (request.headers.has('authorization')) return true;
  return false;
}

/**
 * Applies the response security headers. Called from BOTH onAfterHandle (success
 * path) and onError — in Elysia onAfterHandle does not run when a handler throws,
 * so without the onError call every 4xx/5xx response (validation errors, 401s,
 * 404s, 429s, 500s) would ship without CSP, HSTS, X-Frame-Options or nosniff.
 * Those are exactly the responses most likely to reflect attacker input.
 */
function applySecurityHeaders(
  set: { headers: Record<string, string | number> },
  request: Request,
  csp: string,
  permissionsPolicy: string
): void {
  set.headers['x-content-type-options'] = 'nosniff';
  set.headers['x-frame-options'] = 'DENY';
  set.headers['referrer-policy'] = 'strict-origin-when-cross-origin';
  set.headers['content-security-policy'] = csp;
  if (process.env['NODE_ENV'] === 'production') {
    set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
  }
  set.headers['permissions-policy'] = permissionsPolicy;
  if (shouldDisableHttpCache(request)) {
    set.headers['cache-control'] = 'no-store';
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createApp(options: CreateAppOptions) {
  const { corsOrigins, csp, permissionsPolicy } = options;

  // Single consolidated env check. In production this surfaces EVERY missing
  // required var (and constraint violation) in one error so a misconfigured
  // deploy fails fast with the complete picture, not "fix one, redeploy,
  // hit next". Outside production it is a no-op.
  const envResult = validateEnv();
  if (!envResult.ok) {
    throw new Error(formatValidationError(envResult));
  }

  const app = new Elysia()
    .use(
      cors({
        origin: corsOrigins,
        credentials: true,
        // Cache preflight response for 24h. Browsers cap (Chrome=2h, Firefox=24h),
        // but without this the @elysiajs/cors default is 5s, forcing a fresh OPTIONS
        // round trip for nearly every API call.
        maxAge: 86400,
      })
    )
    .use(swaggerPlugin)
    .onAfterHandle(({ set, request }) => {
      applySecurityHeaders(set, request, csp, permissionsPolicy);
    })
    .use(requestLogger)
    .onError(({ code, error, set, request, reqLogger, startMs }) => {
      // Error responses bypass onAfterHandle, so apply the same security headers
      // here too. Done before the ApiError branch so any error-specific headers
      // (e.g. Retry-After) are layered on top without being overwritten.
      applySecurityHeaders(set, request, csp, permissionsPolicy);
      const log = reqLogger ?? logger;
      const latencyMs = startMs != null ? Date.now() - startMs : undefined;

      if (error instanceof ApiError) {
        set.status = error.statusCode;
        if (error.headers) {
          for (const [key, value] of Object.entries(error.headers)) {
            set.headers[key] = value;
          }
        }
        const level = error.statusCode >= 500 ? 'error' : 'warn';
        log[level]({ status: error.statusCode, code: error.code, latencyMs }, error.message);
        if (error.statusCode >= 500) {
          captureException(error);
          // Flush the queued event past the Response so a serverless freeze does
          // not drop it. keepAlive uses waitUntil on Vercel, run-to-completion off.
          keepAlive(flushSentry());
        }
        return { error: error.message, code: error.code, ...(error.details ?? {}) };
      }

      if (code === 'NOT_FOUND') {
        set.status = 404;
        log.warn({ status: 404, latencyMs }, 'not found');
        return { error: 'Not found', code: 'NOT_FOUND' };
      }

      if (code === 'VALIDATION') {
        set.status = 400;
        log.warn({ status: 400, latencyMs }, 'validation error');
        return { error: 'Validation failed', code: 'VALIDATION_ERROR' };
      }

      if (code === 'PARSE') {
        set.status = 400;
        log.warn({ status: 400, latencyMs }, 'parse error');
        return { error: 'Invalid request body', code: 'PARSE_ERROR' };
      }

      log.error({ err: error, code, status: 500, latencyMs }, 'unhandled error');
      captureException(error);
      // Flush the queued event past the Response so a serverless freeze does not
      // drop it. keepAlive uses waitUntil on Vercel, run-to-completion off.
      keepAlive(flushSentry());
      set.status = 500;
      return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
    })
    .use(
      new Elysia({ prefix: '/api' })
        .use(authRoutes)
        .use(programRoutes)
        .use(catalogRoutes)
        .use(exerciseRoutes)
        .use(resultRoutes)
        .use(statsRoutes)
        .use(insightsRoutes)
        .use(internalRoutes)
        // Health lives UNDER /api (GET /api/health) so it is reachable on Vercel,
        // where only /api/* hits the function and every other path rewrites to
        // index.html. Stateless probe: a live DB SELECT plus an Upstash ping,
        // returning 503 only when the database is unreachable.
        .get(
          '/health',
          async ({ set }) => {
            const start = Date.now();
            let dbStatus: { status: 'ok'; latencyMs: number } | { status: 'error'; error: string };
            try {
              await getDb().execute(sql`SELECT 1`);
              dbStatus = { status: 'ok', latencyMs: Date.now() - start };
            } catch (e) {
              logger.error({ err: e }, 'Database health check failed');
              dbStatus = { status: 'error', error: 'Unavailable' };
            }

            type RedisStatus =
              | { status: 'ok'; latencyMs: number }
              | { status: 'disabled' }
              | { status: 'error'; error: string };

            let redisStatus: RedisStatus;
            const redis = getRedis();
            if (!redis) {
              redisStatus = { status: 'disabled' };
            } else {
              const redisStart = Date.now();
              try {
                await redis.ping();
                redisStatus = { status: 'ok', latencyMs: Date.now() - redisStart };
              } catch (e) {
                logger.error({ err: e }, 'Redis health check failed');
                redisStatus = { status: 'error', error: 'Unavailable' };
              }
            }

            const overall = dbStatus.status === 'ok' ? 'ok' : 'degraded';
            if (overall === 'degraded') set.status = 503;
            return {
              status: overall,
              timestamp: new Date().toISOString(),
              db: dbStatus,
              redis: redisStatus,
            };
          },
          {
            detail: {
              tags: ['System'],
              summary: 'Health check',
              description:
                'Stateless probe running a live database SELECT and an Upstash ping. Returns 503 only when the database is unreachable.',
              responses: {
                200: { description: 'Server and database are healthy' },
                503: { description: 'Database unreachable' },
              },
            },
          }
        )
    );

  return app;
}

export type App = ReturnType<typeof createApp>;
