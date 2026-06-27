/**
 * Standalone deploy step — runs all DDL and reference seeding out of the request
 * path. Intended to be invoked once per deploy (e.g. `bun run db:deploy`) against
 * the direct (non-pooled) Neon endpoint, NOT at module import time.
 *
 * Order of operations:
 *   1. Drizzle migrate (applies the SQL in the migrations folder, including the
 *      `CREATE EXTENSION` statements).
 *   2. Goose-to-Drizzle bridge + hotfix DDL for databases migrated from the Go API.
 *   3. Idempotent reference-data seeds.
 *
 * Every step is idempotent, so the whole script is safe to run twice.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { join } from 'path';
import * as schema from '@gzclp/database/schema';
import { MIGRATIONS_DIR } from '@gzclp/database/migrations';
import { seedMuscleGroups } from '@gzclp/database/seeds/muscle-groups-seed';
import { seedExercises } from '@gzclp/database/seeds/exercises-seed';
import { seedExercisesExpanded } from '@gzclp/database/seeds/exercises-seed-expanded';
import { seedProgramTemplates } from '@gzclp/database/seeds/program-templates-seed';
import { logger } from '../lib/logger';

/**
 * Resolve the direct (non-pooled) connection string for build-time DDL + seeds.
 *
 * Order: an explicit `DIRECT_DATABASE_URL`, then the Neon/Vercel integration's
 * auto-provisioned `DATABASE_URL_UNPOOLED` (its unpooled endpoint), then
 * `DATABASE_URL` for local dev where only one endpoint is configured. The
 * pooled (PgBouncer) endpoint is the last resort because DDL should not run
 * through transaction pooling.
 */
function resolveDirectDatabaseUrl(): string | undefined {
  return (
    process.env['DIRECT_DATABASE_URL'] ??
    process.env['DATABASE_URL_UNPOOLED'] ??
    process.env['DATABASE_URL']
  );
}

/**
 * Resolve the postgres-js TLS mode for the build-time deploy connection.
 *
 * Returns 'require' (force TLS) for any managed/remote endpoint and false only
 * for a plainly-local connection or an explicit DB_SSL=false opt-out. NODE_ENV
 * alone is unreliable here: the Vercel build step does not always run with
 * NODE_ENV=production, so a NODE_ENV-only check left ssl=false and Neon rejected
 * the connection ("connection is insecure (try using sslmode=require)"). Detect
 * the Vercel build (VERCEL is set), a Neon host, or an sslmode=require
 * connection string as well.
 */
function resolveSsl(url: string): 'require' | false {
  if (process.env['DB_SSL'] === 'false') return false;
  const requiresTls =
    process.env['NODE_ENV'] === 'production' ||
    process.env['VERCEL'] !== undefined ||
    /[?&]sslmode=require/i.test(url) ||
    /\.neon\.tech/i.test(url);
  return requiresTls ? 'require' : false;
}

// ---------------------------------------------------------------------------
// Database migrations — DDL must run serially against the direct endpoint
// ---------------------------------------------------------------------------

async function runMigrations(): Promise<void> {
  // DDL runs against the direct (non-pooled) endpoint. Prefers an explicit
  // DIRECT_DATABASE_URL, then the Neon/Vercel integration's auto-provisioned
  // DATABASE_URL_UNPOOLED (the unpooled endpoint), then DATABASE_URL for local
  // dev where only one endpoint is configured.
  const url = resolveDirectDatabaseUrl();
  if (!url) {
    throw new Error(
      'DIRECT_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL environment variable is required'
    );
  }

  // Single-connection client for migrations (DDL must run serially). TLS is
  // forced for managed/remote endpoints (Neon/Vercel) regardless of NODE_ENV.
  const ssl = resolveSsl(url);
  const migrationClient = postgres(url, { max: 1, ssl });
  const migrationDb = drizzle(migrationClient);
  const migrationsFolder = MIGRATIONS_DIR;

  // Detect whether this is a fresh DB or one that already has schema (e.g. the
  // prod DB migrated from goose). The hotfix DDL + goose-to-Drizzle bridge below
  // are only meaningful for an existing schema; on a fresh DB, the regular
  // `migrate()` call at the end of this function creates everything from scratch.
  const [{ exists: schemaExists }] = await migrationClient<[{ exists: boolean }]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    )`;

  if (schemaExists) {
    // Hotfix repair DDL for migrations 0005-0009 (plus the exercises widen). This
    // runs on EVERY deploy whenever the schema already exists, independent of the
    // Drizzle journal entry count. It compensates for a poisoned
    // __drizzle_migrations timestamp that makes Drizzle's migrate() silently skip
    // 0005-0009, so gating it on the one-time journal seed below would re-introduce
    // the very columns/tables those migrations add only on a fresh bridge and never
    // again. Every statement is idempotent (IF NOT EXISTS / ALTER TYPE no-op when
    // the type already matches), so re-running it on routine deploys is safe.

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

    // Goose-to-Drizzle bridge: if the DB has existing schema (from goose) but no
    // Drizzle migration entries, seed the journal so Drizzle skips already-applied
    // migrations. This is a one-time operation for databases migrated from the Go API.
    // Drizzle stores migrations in the "drizzle" schema, not "public". Only the
    // journal seed is gated on entryCount === 0; the repair DDL above always runs.
    await migrationClient`CREATE SCHEMA IF NOT EXISTS "drizzle"`;
    await migrationClient`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`;
    const [{ count: entryCount }] = await migrationClient<[{ count: number }]>`
      SELECT count(*)::int as count FROM "drizzle"."__drizzle_migrations"`;
    if (entryCount === 0) {
      logger.info('detected goose-managed DB without Drizzle entries — bridging schema');

      logger.info('seeding Drizzle migration history');
      const { readdir, readFile } = await import('fs/promises');
      const { createHash } = await import('crypto');
      const files = (await readdir(migrationsFolder)).filter((f) => f.endsWith('.sql')).sort();
      // Migrations 0000-0031 correspond to goose-managed schema; 0032+ are new.
      const gooseEquivalent = files.filter((f) => {
        const idx = parseInt(f.split('_')[0] ?? '', 10);
        return idx <= 31;
      });
      // The Drizzle-generated journal has a fixed shape (drizzle-kit owns it).
      const journalJson: { entries: Array<{ tag: string; when: number }> } = JSON.parse(
        await readFile(join(migrationsFolder, 'meta', '_journal.json'), 'utf-8')
      );
      for (const file of gooseEquivalent) {
        const content = await readFile(join(migrationsFolder, file), 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');
        const tag = file.replace(/\.sql$/, '');
        const entry = journalJson.entries.find((e) => e.tag === tag);
        const createdAt = entry?.when ?? Date.now();
        await migrationClient`
          INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
          VALUES (${hash}, ${createdAt})`;
      }
      logger.info({ count: gooseEquivalent.length }, 'seeded Drizzle migration journal');
    }
  }

  logger.info({ migrationsFolder }, 'running database migrations');
  await migrate(migrationDb, { migrationsFolder });
  await migrationClient.end();
  logger.info('database migrations complete');
}

// ---------------------------------------------------------------------------
// Reference data seeds — idempotent, safe to run on every deploy
// ---------------------------------------------------------------------------

async function runSeeds(): Promise<void> {
  // Seeds run against the SAME direct (non-pooled) endpoint as the migrations, not
  // the pooled endpoint getDb() resolves from DATABASE_URL. This keeps the deploy
  // script on its direct-endpoint contract (see resolveDirectDatabaseUrl).
  const url = resolveDirectDatabaseUrl();
  if (!url) {
    throw new Error(
      'DIRECT_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL environment variable is required'
    );
  }
  // TLS mirrors runMigrations(): forced for managed/remote endpoints (see resolveSsl).
  const ssl = resolveSsl(url);
  const seedClient = postgres(url, { max: 1, ssl });
  const db = drizzle(seedClient, { schema });

  try {
    logger.info('running reference data seeds');
    await seedMuscleGroups(db);
    await seedExercises(db);
    await seedExercisesExpanded(db);
    await seedProgramTemplates(db);

    logger.info('reference data seeds complete');
  } finally {
    await seedClient.end();
  }
}

async function main(): Promise<void> {
  await runMigrations();
  await runSeeds();
}

main()
  .then(() => {
    logger.info('deploy step complete');
    process.exit(0);
  })
  .catch((err: unknown) => {
    logger.error({ err }, 'deploy step failed');
    process.exit(1);
  });
