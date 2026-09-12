import type { DatabaseClient } from './client';
import { createMigrationRunner } from './migration-runner';
import { MIGRATIONS, type MigrationStep } from './migrations';

const history: readonly MigrationStep[] = [
  { version: 1, sql: 'CREATE TABLE example (id INTEGER);' },
  { version: 2, sql: 'ALTER TABLE example ADD COLUMN name TEXT;' },
];

function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** Models transaction rollback, including failures after the schema statement. */
function fakeDatabase(initialVersion = 0) {
  let version = initialVersion;
  const committed: string[] = [];
  const execAsync = jest.fn(async (_sql: string) => {});
  const getAllAsync = jest.fn().mockImplementation(async () => [{ user_version: version }]);
  const client: DatabaseClient = {
    execAsync,
    getAllAsync,
    runAsync: jest.fn(),
    withExclusiveTransactionAsync: jest.fn(async (task) => {
      const pending: string[] = [];
      let nextVersion = version;
      const transaction: DatabaseClient = {
        ...client,
        execAsync: async (sql) => {
          await execAsync(sql);
          pending.push(sql);
          if (sql.startsWith('PRAGMA user_version = ')) {
            nextVersion = Number(sql.split(' = ')[1]);
          }
        },
      };
      await task(transaction);
      version = nextVersion;
      committed.push(...pending);
    }),
  };
  return { client, execAsync, getAllAsync, committed, version: () => version };
}

describe('migration runner', () => {
  it('shares initialization across concurrent calls with an injected connection', async () => {
    const database = fakeDatabase();
    const gate = deferred();
    database.getAllAsync.mockImplementationOnce(async () => {
      await gate.promise;
      return [{ user_version: 0 }];
    });
    const migrate = createMigrationRunner();
    const first = migrate(database.client, history);
    const second = migrate(database.client, [...history]);
    gate.release();
    await Promise.all([first, second]);
    expect(database.getAllAsync).toHaveBeenCalledTimes(1);
    expect(database.committed).toEqual([
      history[0]?.sql,
      'PRAGMA user_version = 1',
      history[1]?.sql,
      'PRAGMA user_version = 2',
    ]);
  });

  it('does not share initialization between separate connections', async () => {
    const first = fakeDatabase();
    const second = fakeDatabase();
    const migrate = createMigrationRunner();
    await Promise.all([migrate(first.client, history), migrate(second.client, history)]);
    expect(first.version()).toBe(2);
    expect(second.version()).toBe(2);
  });

  it('sorts a valid history without mutating the caller array', async () => {
    const reversed = [...history].reverse();
    const database = fakeDatabase();
    await createMigrationRunner()(database.client, reversed);
    expect(reversed[0]?.version).toBe(2);
    expect(database.committed[0]).toBe(history[0]?.sql);
  });

  it.each([
    [{ version: 0, sql: 'SELECT 1' }],
    [{ version: 2, sql: 'SELECT 1' }],
    [{ version: 1.5, sql: 'SELECT 1' }],
    [{ version: Number.NaN, sql: 'SELECT 1' }],
    [{ version: 1, sql: '  ' }],
    [
      { version: 1, sql: 'SELECT 1' },
      { version: 1, sql: 'SELECT 2' },
    ],
  ])('rejects malformed histories before reading or writing SQLite: %j', async (...steps) => {
    const database = fakeDatabase();
    const migrations = steps.filter((step): step is MigrationStep => step !== undefined);
    await expect(createMigrationRunner()(database.client, migrations)).rejects.toThrow(
      'consecutive versions'
    );
    expect(database.getAllAsync).not.toHaveBeenCalled();
    expect(database.execAsync).not.toHaveBeenCalled();
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '1', null])(
    'rejects an invalid stored schema version %j',
    async (version) => {
      const database = fakeDatabase();
      database.getAllAsync.mockResolvedValue([{ user_version: version }]);
      await expect(createMigrationRunner()(database.client, history)).rejects.toThrow(
        'invalid schema version'
      );
      expect(database.execAsync).not.toHaveBeenCalled();
    }
  );

  it.each([[], [{ user_version: 0 }, { user_version: 1 }]])(
    'rejects missing or ambiguous version rows %j',
    async (...rows) => {
      const database = fakeDatabase();
      database.getAllAsync.mockResolvedValue(rows);
      await expect(createMigrationRunner()(database.client, history)).rejects.toThrow(
        'invalid schema version'
      );
    }
  );

  it('refuses to open a newer database without modifying its data', async () => {
    const database = fakeDatabase(3);
    await expect(createMigrationRunner()(database.client, history)).rejects.toThrow(
      'newer than this app'
    );
    expect(database.execAsync).not.toHaveBeenCalled();
    expect(database.version()).toBe(3);
  });

  it('skips already committed migrations', async () => {
    const database = fakeDatabase(1);
    await createMigrationRunner()(database.client, history);
    expect(database.committed).toEqual([history[1]?.sql, 'PRAGMA user_version = 2']);
  });

  it('retries the failed step after rolling back its schema and version', async () => {
    const database = fakeDatabase();
    database.execAsync.mockImplementation(async (sql) => {
      if (sql === 'PRAGMA user_version = 2') throw new Error('disk full');
    });
    const migrate = createMigrationRunner();
    await expect(migrate(database.client, history)).rejects.toThrow('disk full');
    expect(database.version()).toBe(1);
    expect(database.committed).toEqual([history[0]?.sql, 'PRAGMA user_version = 1']);
    database.execAsync.mockImplementation(async () => {});
    await migrate(database.client, history);
    expect(database.version()).toBe(2);
    expect(database.committed.filter((sql) => sql === history[0]?.sql)).toHaveLength(1);
  });

  it('lets all concurrent callers observe a failure and allows a later retry', async () => {
    const database = fakeDatabase();
    const gate = deferred();
    database.getAllAsync.mockImplementationOnce(async () => {
      await gate.promise;
      throw new Error('busy');
    });
    const migrate = createMigrationRunner();
    const results = Promise.allSettled([
      migrate(database.client, history),
      migrate(database.client, history),
    ]);
    gate.release();
    expect((await results).map((result) => result.status)).toEqual(['rejected', 'rejected']);
    await migrate(database.client, history);
    expect(database.version()).toBe(2);
  });

  it('rejects a different history on a connection that is already initialized', async () => {
    const database = fakeDatabase();
    const migrate = createMigrationRunner();
    await migrate(database.client, history);
    await expect(
      migrate(database.client, [{ version: 1, sql: 'DROP TABLE example;' }])
    ).rejects.toThrow('history changed');
    expect(database.version()).toBe(2);
  });

  it('validates the shipped history and caches successful initialization', async () => {
    const database = fakeDatabase();
    const migrate = createMigrationRunner();
    await migrate(database.client, MIGRATIONS);
    await migrate(database.client, MIGRATIONS);
    expect(database.version()).toBe(MIGRATIONS.length);
    expect(database.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('recognizes equivalent histories regardless of object property order', async () => {
    const database = fakeDatabase();
    const migrate = createMigrationRunner();
    await migrate(database.client, history);
    await migrate(
      database.client,
      history.map(({ version, sql }) => ({ sql, version }))
    );
    expect(database.getAllAsync).toHaveBeenCalledTimes(1);
  });

  it('serializes an appended history behind an in-flight initialization', async () => {
    const database = fakeDatabase();
    const gate = deferred();
    database.getAllAsync.mockImplementationOnce(async () => {
      await gate.promise;
      return [{ user_version: 0 }];
    });
    const migrate = createMigrationRunner();
    const first = migrate(database.client, history.slice(0, 1));
    const upgrade = migrate(database.client, history);
    gate.release();
    await Promise.all([first, upgrade]);
    expect(database.version()).toBe(2);
    expect(database.committed).toHaveLength(4);
  });

  it('retries an appended history after the earlier initialization fails', async () => {
    const database = fakeDatabase();
    database.execAsync.mockRejectedValueOnce(new Error('busy'));
    const migrate = createMigrationRunner();
    const results = await Promise.allSettled([
      migrate(database.client, history.slice(0, 1)),
      migrate(database.client, history),
    ]);
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    await migrate(database.client, history);
    expect(database.version()).toBe(2);
  });
});
