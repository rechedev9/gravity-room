import type { DatabaseClient } from './client';
import type { MigrationStep } from './migrations';

/** One connection owns one migration history and one initialization attempt. */
export function createMigrationRunner() {
  const attempts = new WeakMap<
    DatabaseClient,
    { history: readonly MigrationStep[]; promise: Promise<void> }
  >();

  return async function migrate(
    client: DatabaseClient,
    migrations: readonly MigrationStep[]
  ): Promise<void> {
    const ordered = migrations
      .map(({ version, sql }) => ({ version, sql }))
      .sort((a, b) => a.version - b.version);
    for (const [index, migration] of ordered.entries()) {
      if (migration.version !== index + 1 || !migration.sql.trim()) {
        throw new Error('SQLite migrations must contain consecutive versions and non-empty SQL');
      }
    }
    const previous = attempts.get(client);
    if (previous) {
      if (previous.history.some((step, index) => ordered[index]?.sql !== step.sql)) {
        throw new Error('SQLite migration history changed for an initialized connection');
      }
      if (previous.history.length === ordered.length) return previous.promise;
    }

    const promise = (
      previous
        ? previous.promise.then(() => applyMigrations(client, ordered))
        : applyMigrations(client, ordered)
    ).catch((error: unknown) => {
      // A failed attempt may be retried; a committed step is skipped on retry.
      if (attempts.get(client)?.promise === promise) attempts.delete(client);
      throw error;
    });
    attempts.set(client, { history: ordered, promise });
    return promise;
  };
}

async function applyMigrations(
  client: DatabaseClient,
  migrations: readonly MigrationStep[]
): Promise<void> {
  const rows = await client.getAllAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = rows[0]?.user_version;
  if (
    rows.length !== 1 ||
    typeof currentVersion !== 'number' ||
    !Number.isSafeInteger(currentVersion) ||
    currentVersion < 0
  ) {
    throw new Error('SQLite returned an invalid schema version');
  }
  if (currentVersion > migrations.length) {
    throw new Error('SQLite schema is newer than this app; update the app before opening it');
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    await client.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(migration.sql);
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
