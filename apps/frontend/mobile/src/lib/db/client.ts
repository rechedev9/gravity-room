import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { MIGRATIONS, type MigrationStep } from './migrations';

export interface DatabaseClient {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (client: DatabaseClient) => Promise<void>): Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;
let database: SQLiteDatabase | null = null;
let activeLocalDataOwnerId: string | null = null;

function asDatabaseClient(client: SQLiteDatabase): DatabaseClient {
  return client;
}

export function getDatabase(): DatabaseClient {
  if (!database) {
    database = openDatabaseSync('gravity-room.db');
  }

  return asDatabaseClient(database);
}

async function getUserVersion(client: DatabaseClient): Promise<number> {
  const rows = await client.getAllAsync<{ user_version: number }>('PRAGMA user_version');
  return rows[0]?.user_version ?? 0;
}

async function applyMigrations(
  client: DatabaseClient,
  migrations: readonly MigrationStep[]
): Promise<void> {
  const pending = [...migrations].sort((a, b) => a.version - b.version);
  const currentVersion = await getUserVersion(client);

  for (const migration of pending) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await client.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(migration.sql);
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

export async function bootstrapDatabase(
  client: DatabaseClient = getDatabase(),
  migrations: readonly MigrationStep[] = MIGRATIONS
): Promise<void> {
  if (client !== database) {
    await applyMigrations(client, migrations);
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = applyMigrations(client, migrations).catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
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
  if (userId.trim().length === 0) {
    throw new Error('Local data owner must be a non-empty user id');
  }

  await bootstrapDatabase(client);
  activeLocalDataOwnerId = userId;
}

/** Prevent reads, writes, and outbox flushes while auth ownership is changing. */
export function deactivateLocalDataOwner(): void {
  activeLocalDataOwnerId = null;
}

/** Fail closed when a repository is used before account ownership is validated. */
export function requireActiveLocalDataOwner(): string {
  if (!activeLocalDataOwnerId) {
    throw new Error('Local data owner has not been validated');
  }
  return activeLocalDataOwnerId;
}

/** Exposed for transition checks and tests; never use it as an authorization fallback. */
export function getActiveLocalDataOwner(): string | null {
  return activeLocalDataOwnerId;
}

/**
 * Delete every partition during logout/account transition. This is intentionally
 * global: if a previous cleanup failed, stale rows from any owner must be gone
 * before the SecureStore owner marker can be reassigned.
 */
export async function clearLocalAppData(client: DatabaseClient = getDatabase()): Promise<void> {
  await bootstrapDatabase(client);

  await client.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM queued_mutations');
    await transaction.runAsync('DELETE FROM program_details');
    await transaction.runAsync('DELETE FROM program_definitions');
    await transaction.runAsync('DELETE FROM program_summaries');
  });
}
