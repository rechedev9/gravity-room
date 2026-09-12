const { DatabaseSync } = require('node:sqlite');
const { createSqliteTestAdapter } = require('../../../testing/sqlite-adapter.cjs');
const client = require('../db/client');
const {
  recordSyncBackoff,
  readSyncBackoff,
  clearSyncBackoff,
} = require('./sync-backoff-repository');

describe('persisted sync retry lifecycle', () => {
  let sqlite;
  let database;
  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    database = createSqliteTestAdapter(sqlite);
    jest.spyOn(client, 'getDatabase').mockReturnValue(database);
    await client.activateLocalDataOwner('owner-a', database);
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    client.deactivateLocalDataOwner();
    jest.restoreAllMocks();
    sqlite.close();
  });

  function row(owner = 'owner-a') {
    return sqlite.prepare('SELECT * FROM sync_backoff WHERE owner_user_id = ?').get(owner);
  }

  it('persists jitter and capped attempts, then resets after success', async () => {
    expect(await recordSyncBackoff('owner-a')).toBe(1005500);
    for (let index = 0; index < 9; index += 1) await recordSyncBackoff('owner-a');
    expect(row()).toMatchObject({ attempt_count: 7, retry_at_ms: 1330000 });
    await clearSyncBackoff('owner-a');
    expect(await recordSyncBackoff('owner-a')).toBe(1005500);
    expect(row().attempt_count).toBe(1);
  });

  it('preserves a server deadline and rebases a backwards clock only once', async () => {
    await recordSyncBackoff('owner-a', 2000000);
    jest.mocked(Date.now).mockReturnValue(900000);
    expect(await readSyncBackoff('owner-a')).toBe(1900000);
    expect(await readSyncBackoff('owner-a')).toBe(1900000);
    expect(row().attempt_count).toBe(1);
    jest.mocked(Date.now).mockReturnValue(2100000);
    expect(await readSyncBackoff('owner-a')).toBe(1900000);
  });

  it('keeps owner partitions independent', async () => {
    await recordSyncBackoff('owner-a');
    await client.activateLocalDataOwner('owner-b', database);
    await recordSyncBackoff('owner-b', 3000000);
    await clearSyncBackoff('owner-a');
    expect(await readSyncBackoff('owner-a')).toBe(0);
    expect(await readSyncBackoff('owner-b')).toBe(3000000);
  });

  it('rolls back a write if its attempt is cancelled during persistence', async () => {
    await recordSyncBackoff('owner-a');
    const original = row();
    const controller = new AbortController();
    const run = database.runAsync;
    jest.spyOn(database, 'runAsync').mockImplementation(async (...args) => {
      const result = await run(...args);
      controller.abort();
      return result;
    });
    await expect(recordSyncBackoff('owner-a', 3000000, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(row()).toEqual(original);
  });

  it('rolls back a clear if cancelled after its delete', async () => {
    await recordSyncBackoff('owner-a');
    const original = row();
    const controller = new AbortController();
    const run = database.runAsync;
    jest.spyOn(database, 'runAsync').mockImplementation(async (...args) => {
      const result = await run(...args);
      controller.abort();
      return result;
    });
    await expect(clearSyncBackoff('owner-a', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(row()).toEqual(original);
  });

  it('rolls back a write if the owner is deactivated during persistence', async () => {
    await recordSyncBackoff('owner-a');
    const original = row();
    const run = database.runAsync;
    jest.spyOn(database, 'runAsync').mockImplementation(async (...args) => {
      const result = await run(...args);
      client.deactivateLocalDataOwner();
      return result;
    });
    await expect(recordSyncBackoff('owner-a')).rejects.toThrow();
    expect(row()).toEqual(original);
  });

  it('rejects corrupt attempt counts without overwriting the durable evidence', async () => {
    await recordSyncBackoff('owner-a');
    sqlite.prepare('UPDATE sync_backoff SET attempt_count = -1').run();
    const original = row();
    await expect(recordSyncBackoff('owner-a')).rejects.toThrow('Invalid sync retry attempt');
    expect(row()).toEqual(original);
  });
});
