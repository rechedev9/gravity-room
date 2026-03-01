import './lib/sentry';
import { captureException } from './lib/sentry';
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { join, resolve } from 'path';
import { ApiError } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { swaggerPlugin } from './plugins/swagger';
import { metricsPlugin } from './plugins/metrics';
import { registry } from './lib/metrics';
import { cleanupExpiredTokens } from './services/auth';
import { authRoutes } from './routes/auth';
import { programRoutes } from './routes/programs';
import { catalogRoutes } from './routes/catalog';
import { exerciseRoutes } from './routes/exercises';
import { resultRoutes } from './routes/results';
import { programDefinitionRoutes } from './routes/program-definitions';
import { getDb, closeDb } from './db';
import { getRedis } from './lib/redis';
import { logger } from './lib/logger';
import { seedMuscleGroups } from './db/seeds/muscle-groups-seed';
import { seedExercises } from './db/seeds/exercises-seed';
import { seedExercisesExpanded } from './db/seeds/exercises-seed-expanded';
import { seedProgramTemplates } from './db/seeds/program-templates-seed';

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
/**
 * HTTP request timeout in milliseconds.
 * Used by the SHUTDOWN_TIMEOUT_MS fallback and reserved for future HTTP-level
 * timeout middleware (skipped in this change because Elysia hooks cannot
 * reliably abort in-progress handlers; the DB statement_timeout covers the
 * critical path).
 */
export const HTTP_TIMEOUT_MS = 30_000;
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

  // Hotfix: apply DDL from migrations 0005-0009 that were skipped due to a
  // poisoned migration timestamp in __drizzle_migrations. Drizzle's migrator
  // compares the last applied created_at against each migration's folderMillis;
  // a future-dated entry caused all subsequent migrations to be silently skipped.
  // These are all idempotent (IF NOT EXISTS / IF NOT EXISTS) — safe to keep permanently.

  // 0005/0006: RPE columns
  await migrationClient`ALTER TABLE "workout_results" ADD COLUMN IF NOT EXISTS "rpe" smallint`;
  await migrationClient`ALTER TABLE "undo_entries" ADD COLUMN IF NOT EXISTS "prev_rpe" smallint`;

  // 0007: program_definitions table + enum
  await migrationClient`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'program_definition_status') THEN
      CREATE TYPE "public"."program_definition_status"
        AS ENUM('draft', 'pending_review', 'approved', 'rejected');
    END IF;
  END $$`;
  await migrationClient`CREATE TABLE IF NOT EXISTS "program_definitions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "definition" jsonb NOT NULL,
    "status" "program_definition_status" DEFAULT 'draft' NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;
  await migrationClient`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'program_definitions_user_id_users_id_fk'
    ) THEN
      ALTER TABLE "program_definitions" ADD CONSTRAINT "program_definitions_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$`;
  await migrationClient`CREATE INDEX IF NOT EXISTS "program_definitions_user_id_idx"
    ON "program_definitions" USING btree ("user_id")`;
  await migrationClient`CREATE INDEX IF NOT EXISTS "program_definitions_status_idx"
    ON "program_definitions" USING btree ("status")`;

  // 0008: widen slot_id columns (varchar → varchar(50)). ALTER TYPE is idempotent
  // if the column is already varchar(50) — PostgreSQL accepts the same type.
  await migrationClient`ALTER TABLE "workout_results" ALTER COLUMN "slot_id" TYPE varchar(50)`;
  await migrationClient`ALTER TABLE "undo_entries" ALTER COLUMN "slot_id" TYPE varchar(50)`;

  // 0009: user profile columns
  await migrationClient`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text`;
  await migrationClient`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone`;

  // Widen exercises.id from varchar(50) to varchar(100) — 9 expanded exercise IDs
  // exceed 50 chars (e.g. 'lying_close_grip_barbell_triceps_extension_behind_the_head').
  // ALTER TYPE to a wider varchar is non-destructive and requires no data migration.
  await migrationClient`ALTER TABLE IF EXISTS "exercises" ALTER COLUMN "id" TYPE varchar(100)`;

  logger.info({ migrationsFolder }, 'running database migrations');
  await migrate(migrationDb, { migrationsFolder });
  await migrationClient.end();
  logger.info('database migrations complete');
}

await runMigrations();

// ---------------------------------------------------------------------------
// Reference data seeds — idempotent, safe to run on every startup
// ---------------------------------------------------------------------------

async function runSeeds(): Promise<void> {
  const db = getDb();
  logger.info('running reference data seeds');
  await seedMuscleGroups(db);
  await seedExercises(db);
  await seedExercisesExpanded(db);
  await seedProgramTemplates(db);

  // Add FK constraint after seeds populate program_templates.
  // Uses IF NOT EXISTS pattern: idempotent across restarts.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'program_instances_program_id_fk'
      ) THEN
        ALTER TABLE "program_instances"
          ADD CONSTRAINT "program_instances_program_id_fk"
          FOREIGN KEY ("program_id")
          REFERENCES "program_templates"("id")
          ON DELETE RESTRICT;
      END IF;
    END
    $$;
  `);

  logger.info('reference data seeds complete');
}

await runSeeds();

// ---------------------------------------------------------------------------
// Content-Security-Policy — applied to all responses
// ---------------------------------------------------------------------------

const CSP =
  "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.ingest.sentry.io; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-src https://accounts.google.com; frame-ancestors 'none'";

const PERMISSIONS_POLICY: string =
  'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()';

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
    set.headers['permissions-policy'] = PERMISSIONS_POLICY;
  })
  .use(requestLogger)
  .onError(({ code, error, set, reqLogger, startMs }) => {
    const log = reqLogger ?? logger;
    const latencyMs = startMs != null ? Date.now() - startMs : undefined;

    if (error instanceof ApiError) {
      set.status = error.statusCode;
      const level = error.statusCode >= 500 ? 'error' : 'warn';
      log[level]({ status: error.statusCode, code: error.code, latencyMs }, error.message);
      if (error.statusCode >= 500) captureException(error);
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
    captureException(error);
    set.status = 500;
    return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
  })
  .use(authRoutes)
  .use(programRoutes)
  .use(catalogRoutes)
  .use(exerciseRoutes)
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
  .use(
    staticPlugin({
      assets: resolve(import.meta.dir, '../../web/dist'),
      prefix: '/',
      alwaysStatic: true,
    })
  )
  .get('/', () => Bun.file(resolve(import.meta.dir, '../../web/dist/index.html')))
  .get('/.well-known/security.txt', ({ set }) => {
    set.headers['content-type'] = 'text/plain; charset=utf-8';
    return Bun.file(resolve(import.meta.dir, '../../web/dist/.well-known/security.txt'));
  })
  .get('/*', () => Bun.file(resolve(import.meta.dir, '../../web/dist/index.html')))
  .listen({ port: PORT, maxRequestBodySize: 1_048_576 }, () => {
    logger.info({ port: PORT }, 'API started');
  });

export type App = typeof app;

// ---------------------------------------------------------------------------
// Graceful shutdown — drain connections before exit
// ---------------------------------------------------------------------------

/** Idempotency guard: only the first signal triggers shutdown. */
let isShuttingDown = false;

/** Shutdown grace period before forced exit (milliseconds). */
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'signal received, draining connections');

  // Fallback: force-exit if drain stalls
  const fallback = setTimeout(() => {
    logger.warn('forced shutdown after timeout');
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS);
  // Ensure the fallback timer does not keep the process alive on its own
  fallback.unref();

  try {
    await app.stop();
  } catch (err: unknown) {
    logger.error({ err }, 'error stopping Elysia');
  }

  try {
    const redis = getRedis();
    if (redis) {
      await redis.disconnect();
    }
  } catch (err: unknown) {
    logger.error({ err }, 'error disconnecting Redis');
  }

  try {
    await closeDb();
  } catch (err: unknown) {
    logger.error({ err }, 'error closing database pool');
  }

  logger.info('shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

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
