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
import { cleanupExpiredTokens } from './services/auth';
import { authRoutes } from './routes/auth';
import { programRoutes } from './routes/programs';
import { catalogRoutes } from './routes/catalog';
import { resultRoutes } from './routes/results';
import { getDb } from './db';
import { logger } from './lib/logger';
import { version } from '../package.json';

function parseCorsOrigin(raw: string | undefined): string {
  if (!raw) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('CORS_ORIGIN env var must be set in production');
    }
    return 'http://localhost:3000';
  }
  try {
    new URL(raw);
  } catch {
    throw new Error(`CORS_ORIGIN is not a valid URL: "${raw}"`);
  }
  return raw;
}

const CORS_ORIGIN = parseCorsOrigin(process.env['CORS_ORIGIN']);
const PORT = Number(process.env['PORT'] ?? 3001);

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
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

// ---------------------------------------------------------------------------
// Elysia app
// ---------------------------------------------------------------------------

export const app = new Elysia()
  .use(
    cors({
      origin: CORS_ORIGIN,
      credentials: true,
    })
  )
  .use(swaggerPlugin)
  .onAfterHandle(({ set }) => {
    set.headers['x-content-type-options'] = 'nosniff';
    set.headers['x-frame-options'] = 'DENY';
    set.headers['referrer-policy'] = 'strict-origin-when-cross-origin';
    set.headers['content-security-policy'] = CSP;
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
  .get(
    '/health',
    async ({ set }) => {
      const start = Date.now();
      let dbStatus: { status: 'ok'; latencyMs: number } | { status: 'error'; error: string };
      try {
        await getDb().execute(sql`SELECT 1`);
        dbStatus = { status: 'ok', latencyMs: Date.now() - start };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        dbStatus = { status: 'error', error: msg };
      }
      const overall = dbStatus.status === 'ok' ? 'ok' : 'degraded';
      if (overall === 'degraded') set.status = 503;
      return {
        status: overall,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version,
        db: dbStatus,
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
  .use(staticPlugin({ assets: '../web/dist', prefix: '/' }))
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

// ---------------------------------------------------------------------------
// Expired refresh token cleanup — run at startup then every 6h
// ---------------------------------------------------------------------------

const TOKEN_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

cleanupExpiredTokens().catch((e: unknown) => logger.error({ err: e }, 'Token cleanup failed'));
setInterval(() => {
  cleanupExpiredTokens().catch((e: unknown) => logger.error({ err: e }, 'Token cleanup failed'));
}, TOKEN_CLEANUP_INTERVAL_MS);
