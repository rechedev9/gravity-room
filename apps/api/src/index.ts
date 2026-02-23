import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { join } from 'path';
import { ApiError } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { swaggerPlugin } from './plugins/swagger';
import { metricsPlugin } from './plugins/metrics';
import { registry } from './lib/metrics';
import { cleanupExpiredTokens } from './services/auth';
import { authRoutes } from './routes/auth';
import { programRoutes } from './routes/programs';
import { catalogRoutes } from './routes/catalog';
import { resultRoutes } from './routes/results';
import { programDefinitionRoutes } from './routes/program-definitions';
import { getDb } from './db';
import { getRedis } from './lib/redis';
import { logger } from './lib/logger';

function parseCorsOrigins(raw: string | undefined): string | string[] {
  if (!raw) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('CORS_ORIGIN env var must be set in production');
    }
    return 'http://localhost:3000';
  }
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const origin of origins) {
    try {
      new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains invalid URL: "${origin}"`);
    }
  }
  const first = origins[0];
  return origins.length === 1 && first !== undefined ? first : origins;
}

const CORS_ORIGINS = parseCorsOrigins(process.env['CORS_ORIGIN']);
const PORT = Number(process.env['PORT'] ?? 3001);
// METRICS_TOKEN — optional. When set, GET /metrics requires "Authorization: Bearer <token>".
// Leave unset in local development. Required in production to protect Prometheus metrics.

// ---------------------------------------------------------------------------
// Database migrations — run before accepting traffic
// ---------------------------------------------------------------------------

async function runMigrations(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL environment variable is required');

  // Single-connection client for migrations (DDL must run serially)
  const migrationClient = postgres(url, { max: 1 });
  const migrationDb = drizzle(migrationClient);
  const migrationsFolder = join(import.meta.dir, '..', 'drizzle');

  // Hotfix: add columns that were skipped due to a poisoned migration timestamp.
  // Safe to keep permanently — IF NOT EXISTS is a no-op once columns exist.
  await migrationClient`ALTER TABLE "workout_results" ADD COLUMN IF NOT EXISTS "rpe" smallint`;
  await migrationClient`ALTER TABLE "undo_entries" ADD COLUMN IF NOT EXISTS "prev_rpe" smallint`;

  logger.info({ migrationsFolder }, 'running database migrations');
  await migrate(migrationDb, { migrationsFolder });
  await migrationClient.end();
  logger.info('database migrations complete');
}

await runMigrations();

// ---------------------------------------------------------------------------
// Content-Security-Policy — applied to all responses
// ---------------------------------------------------------------------------

const CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'";

// ---------------------------------------------------------------------------
// Elysia app
// ---------------------------------------------------------------------------

export const app = new Elysia()
  .use(
    cors({
      origin: CORS_ORIGINS,
      credentials: true,
    })
  )
  .use(swaggerPlugin)
  .use(metricsPlugin)
  .onAfterHandle(({ set }) => {
    set.headers['x-content-type-options'] = 'nosniff';
    set.headers['x-frame-options'] = 'DENY';
    set.headers['referrer-policy'] = 'strict-origin-when-cross-origin';
    set.headers['content-security-policy'] = CSP;
    if (process.env['NODE_ENV'] === 'production') {
      set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
    }
  })
  .use(requestLogger)
  .onError(({ code, error, set, reqLogger, startMs }) => {
    const log = reqLogger ?? logger;
    const latencyMs = startMs != null ? Date.now() - startMs : undefined;

    if (error instanceof ApiError) {
      set.status = error.statusCode;
      const level = error.statusCode >= 500 ? 'error' : 'warn';
      log[level]({ status: error.statusCode, code: error.code, latencyMs }, error.message);
      return { error: error.message, code: error.code };
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
    set.status = 500;
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  .use(authRoutes)
  .use(programRoutes)
  .use(catalogRoutes)
  .use(resultRoutes)
  .use(programDefinitionRoutes)
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
    const expectedToken = process.env['METRICS_TOKEN'];
    if (expectedToken) {
      const auth = headers['authorization'];
      if (auth !== `Bearer ${expectedToken}`) {
        throw new ApiError(401, 'Invalid metrics token', 'UNAUTHORIZED');
      }
    }
    set.headers['content-type'] = registry.contentType;
    return registry.metrics();
  })
  .use(staticPlugin({ assets: '../web/dist', prefix: '/' }))
  .get('/', () => Bun.file('../web/dist/index.html'))
  .get('/*', () => Bun.file('../web/dist/index.html'))
  .listen({ port: PORT, maxRequestBodySize: 1_048_576 }, () => {
    logger.info({ port: PORT }, 'API started');
  });

export type App = typeof app;

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// ---------------------------------------------------------------------------
// Expired token cleanup — run at startup then every 6h
// ---------------------------------------------------------------------------

const TOKEN_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

function runCleanup(): void {
  cleanupExpiredTokens().catch((e: unknown) =>
    logger.error({ err: e }, 'Refresh token cleanup failed')
  );
}

runCleanup();
setInterval(runCleanup, TOKEN_CLEANUP_INTERVAL_MS);
