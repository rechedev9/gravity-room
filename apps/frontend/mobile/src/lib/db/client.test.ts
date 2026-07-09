import { openDatabaseSync } from 'expo-sqlite';

import { bootstrapDatabase, getDatabase, type DatabaseClient } from './client';
import type { MigrationStep } from './migrations';

const mockedOpenDatabaseSync = jest.mocked(openDatabaseSync);

interface FakeDatabase extends DatabaseClient {
  readonly getVersion: () => number;
  readonly appliedSql: string[];
}

function createFakeDatabase(initialVersion: number): FakeDatabase {
  let userVersion = initialVersion;
  const appliedSql: string[] = [];

  const execAsync = jest.fn(async (source: string) => {
    appliedSql.push(source);

    const versionMatch = /PRAGMA user_version\s*=\s*(\d+)/.exec(source);
    if (versionMatch?.[1]) {
      userVersion = Number(versionMatch[1]);
    }
  });

  async function getAllAsync<T>(source: string): Promise<T[]> {
    if (source.trim() === 'PRAGMA user_version') {
      const row = { user_version: userVersion } as unknown as T;
      return [row];
    }

    return [];
  }

  const runAsync = jest.fn(async () => undefined);

  const database: FakeDatabase = {
    execAsync,
    getAllAsync,
    runAsync,
    withExclusiveTransactionAsync: jest.fn(
      async (task: (client: DatabaseClient) => Promise<void>) => {
        await task(database);
      }
    ),
    getVersion: () => userVersion,
    appliedSql,
  };

  return database;
}

describe('bootstrapDatabase', () => {
  afterEach(() => {
    mockedOpenDatabaseSync.mockReset();
  });

  it('retries bootstrap after a previous failure', async () => {
    const database = createFakeDatabase(0);
    const execAsync = jest
      .fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error('disk busy'))
      .mockImplementation(database.execAsync);
    database.execAsync = execAsync;

    mockedOpenDatabaseSync.mockReturnValue(database as never);

    await expect(bootstrapDatabase()).rejects.toThrow('disk busy');
    await expect(bootstrapDatabase()).resolves.toBeUndefined();

    expect(execAsync).toHaveBeenCalledTimes(3);
    expect(database.getVersion()).toBe(1);
  });

  it('returns the same database instance across calls', () => {
    mockedOpenDatabaseSync.mockReturnValue(createFakeDatabase(0) as never);

    expect(getDatabase()).toBe(getDatabase());
  });

  it('brings a fresh database to the latest version with all tables', async () => {
    const database = createFakeDatabase(0);

    await bootstrapDatabase(database);

    expect(database.getVersion()).toBe(1);
    expect(
      database.appliedSql.some((sql) =>
        sql.includes('CREATE TABLE IF NOT EXISTS program_summaries')
      )
    ).toBe(true);
    expect(
      database.appliedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS queued_mutations'))
    ).toBe(true);
    expect(
      database.appliedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS program_details'))
    ).toBe(true);
    expect(
      database.appliedSql.some((sql) =>
        sql.includes('CREATE TABLE IF NOT EXISTS program_definitions')
      )
    ).toBe(true);
    expect(database.appliedSql).toContain('PRAGMA user_version = 1');
  });

  it('migrates a pre-existing install stuck at version 0 without erroring', async () => {
    // Simulates an install that already ran the old, non-versioned bootstrap:
    // the tables exist, but PRAGMA user_version was never set.
    const database = createFakeDatabase(0);

    await bootstrapDatabase(database);
    expect(database.getVersion()).toBe(1);

    // Running it again (e.g. next app launch) must be a no-op: the CREATE
    // TABLE IF NOT EXISTS statements never re-run once the version matches.
    const sqlCountAfterFirstRun = database.appliedSql.length;
    await bootstrapDatabase(database);
    expect(database.appliedSql.length).toBe(sqlCountAfterFirstRun);
  });

  it('applies a future migration in order after the baseline', async () => {
    const dummyMigration: MigrationStep = {
      version: 2,
      sql: 'ALTER TABLE program_summaries ADD COLUMN archived_at TEXT;',
    };
    const baseline: MigrationStep = {
      version: 1,
      sql: 'CREATE TABLE IF NOT EXISTS program_summaries (id TEXT);',
    };
    const database = createFakeDatabase(0);

    await bootstrapDatabase(database, [dummyMigration, baseline]);

    expect(database.getVersion()).toBe(2);
    const baselineIndex = database.appliedSql.indexOf(baseline.sql);
    const dummyIndex = database.appliedSql.indexOf(dummyMigration.sql);
    expect(baselineIndex).toBeGreaterThanOrEqual(0);
    expect(dummyIndex).toBeGreaterThan(baselineIndex);
    expect(database.appliedSql).toContain('PRAGMA user_version = 1');
    expect(database.appliedSql).toContain('PRAGMA user_version = 2');
  });

  it('skips migrations already applied when starting above version 0', async () => {
    const dummyMigration: MigrationStep = {
      version: 2,
      sql: 'ALTER TABLE program_summaries ADD COLUMN archived_at TEXT;',
    };
    const baseline: MigrationStep = {
      version: 1,
      sql: 'CREATE TABLE IF NOT EXISTS program_summaries (id TEXT);',
    };
    const database = createFakeDatabase(1);

    await bootstrapDatabase(database, [dummyMigration, baseline]);

    expect(database.getVersion()).toBe(2);
    expect(database.appliedSql).not.toContain(baseline.sql);
    expect(database.appliedSql).toContain(dummyMigration.sql);
  });
});
