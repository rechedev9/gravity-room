import { captureException } from './lib/sentry';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { ApiError } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { swaggerPlugin } from './plugins/swagger';
import { metricsPlugin } from './plugins/metrics';
import { registry } from './lib/metrics';
import { authRoutes } from './routes/auth';
import { programRoutes } from './routes/programs';
import { catalogRoutes } from './routes/catalog';
import { exerciseRoutes } from './routes/exercises';
import { resultRoutes } from './routes/results';
import { statsRoutes } from './routes/stats';
import { insightsRoutes } from './routes/insights';
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

  const metricsToken = process.env['METRICS_TOKEN'];
  const metricsExpected = metricsToken ? Buffer.from(`Bearer ${metricsToken}`) : null;

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
    .use(metricsPlugin)
    .onAfterHandle(({ set }) => {
      set.headers['x-content-type-options'] = 'nosniff';
      set.headers['x-frame-options'] = 'DENY';
      set.headers['referrer-policy'] = 'strict-origin-when-cross-origin';
      set.headers['content-security-policy'] = csp;
      if (process.env['NODE_ENV'] === 'production') {
        set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
      }
      set.headers['permissions-policy'] = permissionsPolicy;
    })
    .use(requestLogger)
    .onError(({ code, error, set, reqLogger, startMs }) => {
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
        if (error.statusCode >= 500) captureException(error);
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
    )
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
          uptime: Math.floor(process.uptime()),
          db: dbStatus,
          redis: redisStatus,
        };
      },
      {
        detail: {
          tags: ['System'],
          summary: 'Health check',
          description:
            'Returns server uptime and a live database probe. Returns 503 when the database is unreachable.',
          responses: {
            200: { description: 'Server and database are healthy' },
            503: { description: 'Database unreachable' },
          },
        },
      }
    )
    .get('/metrics', async ({ set, headers }) => {
      if (metricsExpected) {
        const provided = Buffer.from(headers['authorization'] ?? '');
        const ok =
          provided.length === metricsExpected.length && timingSafeEqual(provided, metricsExpected);
        if (!ok) {
          throw new ApiError(401, 'Invalid metrics token', 'UNAUTHORIZED');
        }
      }
      set.headers['content-type'] = registry.contentType;
      return registry.metrics();
    });

  return app;
}

export type App = ReturnType<typeof createApp>;
