import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS, type MigrationStep } from './migrations';
import { createMigrationRunner } from './migration-runner';
import { LocalDataOwner } from './local-data-owner';

export interface DatabaseClient {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (client: DatabaseClient) => Promise<void>): Promise<void>;
}

const migrateDatabase = createMigrationRunner();
let database: SQLiteDatabase | null = null;
const localDataOwner = new LocalDataOwner();

function asDatabaseClient(client: SQLiteDatabase): DatabaseClient {
  return client;
}

export function getDatabase(): DatabaseClient {
  if (!database) {
    database = openDatabaseSync('gravity-room.db');
  }

  return asDatabaseClient(database);
}

export async function bootstrapDatabase(
  client: DatabaseClient = getDatabase(),
  migrations: readonly MigrationStep[] = MIGRATIONS
): Promise<void> {
  await migrateDatabase(client, migrations);
}

/**
 * Validate SQLite before exposing an authenticated account, then bind every
 * repository operation to that account in memory. The owner is deliberately
 * not accepted from callers at each query boundary: UI code cannot accidentally
 * select another account by passing the wrong id.
 */
export async function activateLocalDataOwner(
  userId: string,
  client: DatabaseClient = getDatabase()
): Promise<void> {
  await localDataOwner.activate(userId, () => bootstrapDatabase(client));
}

/** Prevent reads, writes, and outbox flushes while auth ownership is changing. */
export function deactivateLocalDataOwner(): void {
  localDataOwner.deactivate();
}

/** Fail closed when a repository is used before account ownership is validated. */
export function requireActiveLocalDataOwner(): string {
  return localDataOwner.require();
}

/** Exposed for transition checks and tests; never use it as an authorization fallback. */
export function getActiveLocalDataOwner(): string | null {
  return localDataOwner.get();
}

/**
 * Delete every partition during logout/account transition. This is intentionally
 * global: if a previous cleanup failed, stale rows from any owner must be gone
 * before the SecureStore owner marker can be reassigned.
 */
export async function clearLocalAppData(client: DatabaseClient = getDatabase()): Promise<void> {
  await bootstrapDatabase(client);

  await client.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM set_drafts');
    await transaction.runAsync('DELETE FROM queued_mutations');
    await transaction.runAsync('DELETE FROM sync_backoff');
    await transaction.runAsync('DELETE FROM program_details');
    await transaction.runAsync('DELETE FROM program_definitions');
    await transaction.runAsync('DELETE FROM program_summaries');
  });
}
