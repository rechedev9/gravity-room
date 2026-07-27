import { openMobileDatabase, type DatabaseClient } from './expo-sqlite-adapter';
import { MIGRATIONS, type MigrationStep } from './migrations';

let bootstrapPromise: Promise<void> | null = null;
let database: DatabaseClient | null = null;

export function getDatabase(): DatabaseClient {
  if (!database) {
    database = openMobileDatabase();
  }

  return database;
}

async function getUserVersion(client: DatabaseClient): Promise<number> {
  const row = (await client.getAllAsync('PRAGMA user_version'))[0];

  if (
    typeof row !== 'object' ||
    row === null ||
    !('user_version' in row) ||
    typeof row.user_version !== 'number' ||
    !Number.isInteger(row.user_version) ||
    row.user_version < 0
  ) {
    throw new Error('SQLite returned an invalid user_version');
  }

  return row.user_version;
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

export async function clearLocalAppData(client: DatabaseClient = getDatabase()): Promise<void> {
  await bootstrapDatabase(client);

  await client.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM mobile_v2_program_reconciliations');
    await transaction.runAsync('DELETE FROM mobile_v2_program_preferences');
    await transaction.runAsync('DELETE FROM mobile_v2_program_catalog');
    await transaction.runAsync('DELETE FROM mobile_v2_program_details');
    await transaction.runAsync('DELETE FROM mobile_v2_program_definitions');
    await transaction.runAsync('DELETE FROM mobile_v2_program_summaries');
    await transaction.runAsync('DELETE FROM queued_mutations');
    await transaction.runAsync('DELETE FROM program_details');
    await transaction.runAsync('DELETE FROM program_definitions');
    await transaction.runAsync('DELETE FROM program_summaries');
  });
}
