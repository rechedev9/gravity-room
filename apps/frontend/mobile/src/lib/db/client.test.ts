import { openDatabaseSync } from 'expo-sqlite';

import { bootstrapDatabase, getDatabase, type DatabaseClient } from './client';
import type { MigrationStep } from './migrations';
import {
  EMPTY_DATABASE_FIXTURE,
  LEGACY_UNVERSIONED_DATABASE_FIXTURE,
  V1_DATABASE_FIXTURE,
  type MobileDatabaseFixture,
} from '../../testing/fixtures/mobile-v2-fixtures';

const mockedOpenDatabaseSync = jest.mocked(openDatabaseSync);

interface FakeDatabase extends DatabaseClient {
  readonly getVersion: () => number;
  readonly getTableNames: () => readonly string[];
  readonly appliedSql: string[];
}

function createFakeDatabase(fixture: MobileDatabaseFixture): FakeDatabase {
  let userVersion = fixture.userVersion;
  const tableNames = new Set(fixture.tables);
  const appliedSql: string[] = [];

  const execAsync = jest.fn(async (source: string) => {
    appliedSql.push(source);

    for (const match of source.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/g)) {
      const tableName = match[1];
      if (tableName !== undefined) {
        tableNames.add(tableName);
      }
    }

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
    getTableNames: () => [...tableNames].sort(),
    appliedSql,
  };

  return database;
}

describe('bootstrapDatabase', () => {
  afterEach(() => {
    mockedOpenDatabaseSync.mockReset();
  });

  it('retries bootstrap after a previous failure', async () => {
    const database = createFakeDatabase(EMPTY_DATABASE_FIXTURE);
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
    mockedOpenDatabaseSync.mockReturnValue(createFakeDatabase(EMPTY_DATABASE_FIXTURE) as never);

    expect(getDatabase()).toBe(getDatabase());
  });

  it('brings a fresh database to the latest version with all tables', async () => {
    const database = createFakeDatabase(EMPTY_DATABASE_FIXTURE);

    await bootstrapDatabase(database);

    expect(database.getVersion()).toBe(1);
    expect(database.getTableNames()).toEqual([...V1_DATABASE_FIXTURE.tables].sort());
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
    const database = createFakeDatabase(LEGACY_UNVERSIONED_DATABASE_FIXTURE);

    await bootstrapDatabase(database);
    expect(database.getVersion()).toBe(1);
    expect(database.getTableNames()).toEqual([...V1_DATABASE_FIXTURE.tables].sort());

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
    const database = createFakeDatabase(EMPTY_DATABASE_FIXTURE);

    await bootstrapDatabase(database, [dummyMigration, baseline]);

    expect(database.getVersion()).toBe(2);
    const baselineIndex = database.appliedSql.indexOf(baseline.sql);
    const dummyIndex = database.appliedSql.indexOf(dummyMigration.sql);
    expect(baselineIndex).toBeGreaterThanOrEqual(0);
    expect(dummyIndex).toBeGreaterThan(baselineIndex);
    expect(database.appliedSql).toContain('PRAGMA user_version = 1');
    expect(database.appliedSql).toContain('PRAGMA user_version = 2');
  });

  it('leaves a v1 installation untouched when no later migration exists', async () => {
    const database = createFakeDatabase(V1_DATABASE_FIXTURE);

    await bootstrapDatabase(database);

    expect(database.getVersion()).toBe(1);
    expect(database.getTableNames()).toEqual([...V1_DATABASE_FIXTURE.tables].sort());
    expect(database.appliedSql).toEqual([]);
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
    const database = createFakeDatabase(V1_DATABASE_FIXTURE);

    await bootstrapDatabase(database, [dummyMigration, baseline]);

    expect(database.getVersion()).toBe(2);
    expect(database.appliedSql).not.toContain(baseline.sql);
    expect(database.appliedSql).toContain(dummyMigration.sql);
  });
});
