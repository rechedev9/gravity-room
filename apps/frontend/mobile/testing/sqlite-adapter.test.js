const { DatabaseSync } = require('node:sqlite');
const { createSqliteTestAdapter } = require('./sqlite-adapter.cjs');

describe('real SQLite async test adapter', () => {
  let sqlite;
  let database;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    database = createSqliteTestAdapter(sqlite);
    sqlite.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sqlite.close();
  });

  it('binds parameters without interpolating values into SQL', async () => {
    const value = "quote'); DROP TABLE items; --";
    const result = await database.runAsync('INSERT INTO items (value) VALUES (?)', value);
    expect(result.changes).toBe(1);
    expect(
      await database.getAllAsync('SELECT value FROM items WHERE id = ?', result.lastInsertRowid)
    ).toEqual([{ value }]);
  });

  it('supports nullable and numeric parameters and empty query results', async () => {
    await database.runAsync('INSERT INTO items (id, value) VALUES (?, ?)', 7, null);
    expect(await database.getAllAsync('SELECT * FROM items WHERE id = ?', 7)).toEqual([
      { id: 7, value: null },
    ]);
    expect(await database.getAllAsync('SELECT * FROM items WHERE id = ?', 8)).toEqual([]);
  });

  it('executes migration scripts containing multiple statements', async () => {
    await database.execAsync(
      'CREATE TABLE extra (id INTEGER); INSERT INTO extra VALUES (1); PRAGMA user_version = 1;'
    );
    expect(await database.getAllAsync('PRAGMA user_version')).toEqual([{ user_version: 1 }]);
    expect(await database.getAllAsync('SELECT * FROM extra')).toEqual([{ id: 1 }]);
  });

  it('commits all writes after the asynchronous callback finishes', async () => {
    await database.withExclusiveTransactionAsync(async (tx) => {
      expect(tx).toBe(database);
      await tx.runAsync('INSERT INTO items VALUES (?, ?)', 1, 'first');
      await Promise.resolve();
      await tx.runAsync('INSERT INTO items VALUES (?, ?)', 2, 'second');
    });
    expect(await database.getAllAsync('SELECT value FROM items ORDER BY id')).toEqual([
      { value: 'first' },
      { value: 'second' },
    ]);
  });

  it('rolls back both DDL and writes and preserves the original error', async () => {
    const original = new Error('write failed');
    const pending = database.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync('CREATE TABLE partial (id INTEGER)');
      await tx.runAsync('INSERT INTO items VALUES (?, ?)', 1, 'partial');
      throw original;
    });
    await expect(pending).rejects.toBe(original);
    expect(await database.getAllAsync('SELECT * FROM items')).toEqual([]);
    expect(
      await database.getAllAsync("SELECT name FROM sqlite_master WHERE name = 'partial'")
    ).toEqual([]);
  });

  it('rolls back a synchronous callback exception too', async () => {
    const original = new Error('sync failure');
    await expect(
      database.withExclusiveTransactionAsync(() => {
        throw original;
      })
    ).rejects.toBe(original);
    await database.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('INSERT INTO items VALUES (?, ?)', 1, 'retry');
    });
    expect(await database.getAllAsync('SELECT value FROM items')).toEqual([{ value: 'retry' }]);
  });

  it('rolls back writes when COMMIT fails', async () => {
    const exec = sqlite.exec.bind(sqlite);
    const original = new Error('commit failed');
    jest.spyOn(sqlite, 'exec').mockImplementation((sql) => {
      if (sql === 'COMMIT') throw original;
      return exec(sql);
    });
    await expect(
      database.withExclusiveTransactionAsync(async (tx) => {
        await tx.runAsync('INSERT INTO items VALUES (?, ?)', 1, 'partial');
      })
    ).rejects.toBe(original);
    expect(await database.getAllAsync('SELECT * FROM items')).toEqual([]);
  });

  it('does not roll back a transaction it failed to acquire', async () => {
    sqlite.exec('BEGIN EXCLUSIVE');
    sqlite.exec("INSERT INTO items VALUES (1, 'external')");
    const callback = jest.fn();
    await expect(database.withExclusiveTransactionAsync(callback)).rejects.toThrow();
    expect(callback).not.toHaveBeenCalled();
    sqlite.exec('COMMIT');
    expect(await database.getAllAsync('SELECT value FROM items')).toEqual([{ value: 'external' }]);
  });

  it('keeps the first failure visible when rollback also fails', async () => {
    const exec = sqlite.exec.bind(sqlite);
    const original = new Error('original failure');
    const cleanup = new Error('rollback failure');
    jest.spyOn(sqlite, 'exec').mockImplementation((sql) => {
      if (sql === 'ROLLBACK') throw cleanup;
      return exec(sql);
    });
    await expect(
      database.withExclusiveTransactionAsync(async () => {
        throw original;
      })
    ).rejects.toMatchObject({
      cause: original,
      errors: [original, cleanup],
    });
  });

  it('does not own or close the caller connection', async () => {
    await database.withExclusiveTransactionAsync(async () => {});
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM items').get().count).toBe(0);
  });
});
