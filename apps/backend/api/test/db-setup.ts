/**
 * E2E integration test database setup.
 *
 * Usage: bun test --preload ./test/db-setup.ts test/e2e/**
 *
 * Redirects DATABASE_URL to DATABASE_URL_TEST so all service functions
 * automatically connect to the test database without any refactoring.
 * Runs Drizzle migrations once at startup (idempotent), then exports helpers
 * for per-test cleanup.
 *
 * Requires DATABASE_URL_TEST env var pointing at a dedicated PostgreSQL
 * database (its data will be wiped between tests).
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { join } from 'path';
import * as schema from '../src/db/schema';

// ── Redirect DATABASE_URL → test database ────────────────────────────────────
// Must happen BEFORE any service module is imported so getDb() picks it up.
const TEST_DB_URL = process.env['DATABASE_URL_TEST'];
if (!TEST_DB_URL) {
  throw new Error(
    'DATABASE_URL_TEST is required for integration tests.\n' +
      'Point it at a dedicated PostgreSQL database (its data will be wiped).'
  );
}
process.env['DATABASE_URL'] = TEST_DB_URL;

// ── Types ────────────────────────────────────────────────────────────────────

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

// ── Singleton connection ──────────────────────────────────────────────────────

let _client: postgres.Sql | undefined;
let _db: TestDb | undefined;

/**
 * Connects to the test database and runs all pending migrations.
 * Safe to call multiple times — re-uses the existing connection.
 */
export async function setupTestDb(): Promise<TestDb> {
  if (_db) return _db;

  // Run migrations with a dedicated single-connection client (DDL must be serial)
  const migrationClient = postgres(TEST_DB_URL, { max: 1 });
  await migrate(drizzle(migrationClient), {
    migrationsFolder: join(import.meta.dir, '..', 'drizzle'),
  });
  await migrationClient.end();

  _client = postgres(TEST_DB_URL, { max: 5 });
  _db = drizzle(_client, { schema });
  return _db;
}

export function getTestDb(): TestDb {
  if (!_db) throw new Error('Call setupTestDb() first');
  return _db;
}

export async function teardownTestDb(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = undefined;
    _db = undefined;
  }
}

/**
 * Truncates all application tables in dependency order.
 * Call in afterEach to reset state between tests.
 */
export async function truncateAllTables(): Promise<void> {
  await getTestDb().execute(
    sql`TRUNCATE TABLE
          undo_entries,
          workout_results,
          program_instances,
          password_reset_tokens,
          refresh_tokens,
          users
        CASCADE`
  );
}
