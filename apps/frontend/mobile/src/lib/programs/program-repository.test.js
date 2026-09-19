const { DatabaseSync } = require('node:sqlite');
const { createSqliteTestAdapter } = require('../../../testing/sqlite-adapter.cjs');
const client = require('../db/client');
const {
  listProgramSummaries,
  removeProgramSummary,
  upsertProgramSummaries,
} = require('./program-repository');

const summary = (id, title = id, updatedAt = '2026-09-01') => ({ id, title, updatedAt });

describe('removeProgramSummary', () => {
  let sqlite;
  let database;
  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    database = createSqliteTestAdapter(sqlite);
    jest.spyOn(client, 'getDatabase').mockReturnValue(database);
    await client.activateLocalDataOwner('owner-a', database);
  });
  afterEach(() => {
    client.deactivateLocalDataOwner();
    jest.restoreAllMocks();
    sqlite.close();
  });

  it('drops only the requested plan of the active owner', async () => {
    await upsertProgramSummaries([summary('a'), summary('b')]);
    await client.activateLocalDataOwner('owner-b', database);
    await upsertProgramSummaries([summary('a', 'Other owner')]);
    await client.activateLocalDataOwner('owner-a', database);
    await removeProgramSummary('a');
    expect((await listProgramSummaries()).map((row) => row.id)).toEqual(['b']);
    await client.activateLocalDataOwner('owner-b', database);
    expect((await listProgramSummaries()).map((row) => row.title)).toEqual(['Other owner']);
  });

  it('ignores an unknown plan id', async () => {
    await upsertProgramSummaries([summary('a')]);
    await removeProgramSummary('missing');
    expect((await listProgramSummaries()).map((row) => row.id)).toEqual(['a']);
  });
});

describe('summary snapshot SQL', () => {
  let sqlite;
  let database;
  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    database = createSqliteTestAdapter(sqlite);
    jest.spyOn(client, 'getDatabase').mockReturnValue(database);
    await client.activateLocalDataOwner('owner-a', database);
  });
  afterEach(() => {
    client.deactivateLocalDataOwner();
    jest.restoreAllMocks();
    sqlite.close();
  });

  it.each(['owner-a', 'owner-b'])('reads only %s even when instance IDs collide', async (owner) => {
    await upsertProgramSummaries([summary('shared', 'Account A')]);
    await client.activateLocalDataOwner('owner-b', database);
    await upsertProgramSummaries([summary('shared', 'Account B')]);
    await client.activateLocalDataOwner(owner, database);
    expect(await listProgramSummaries()).toEqual([
      summary('shared', owner === 'owner-a' ? 'Account A' : 'Account B'),
    ]);
  });

  it('orders by update date descending then title ascending', async () => {
    await upsertProgramSummaries([
      summary('old', 'Old', '2026-08-01'),
      summary('b', 'Beta'),
      summary('a', 'Alpha'),
    ]);
    expect((await listProgramSummaries()).map((row) => row.id)).toEqual(['a', 'b', 'old']);
  });

  it('replaces removed rows and handles an empty snapshot without touching another owner', async () => {
    await upsertProgramSummaries([summary('a'), summary('b')]);
    await client.activateLocalDataOwner('owner-b', database);
    await upsertProgramSummaries([summary('a', 'B copy')]);
    await client.activateLocalDataOwner('owner-a', database);
    await upsertProgramSummaries([summary('b', 'Updated')]);
    expect(await listProgramSummaries()).toEqual([summary('b', 'Updated')]);
    await upsertProgramSummaries([]);
    expect(await listProgramSummaries()).toEqual([]);
    await client.activateLocalDataOwner('owner-b', database);
    expect(await listProgramSummaries()).toEqual([summary('a', 'B copy')]);
  });

  it('rolls back pruning if a subsequent insert fails', async () => {
    const initial = [summary('a'), summary('b')];
    await upsertProgramSummaries(initial);
    const failure = new Error('write failed');
    const run = database.runAsync;
    jest.spyOn(database, 'runAsync').mockImplementation(async (sql, ...params) => {
      if (sql.includes('INSERT')) throw failure;
      return run(sql, ...params);
    });
    await expect(upsertProgramSummaries([summary('b', 'Updated')])).rejects.toBe(failure);
    expect(await listProgramSummaries()).toEqual(initial);
  });

  it('preserves optional artwork identity on retained rows and updates explicit identities', async () => {
    await upsertProgramSummaries([{ ...summary('a'), programId: 'gzclp' }]);
    await upsertProgramSummaries([summary('a', 'Renamed')]);
    expect(await listProgramSummaries()).toEqual([
      { ...summary('a', 'Renamed'), programId: 'gzclp' },
    ]);
    await upsertProgramSummaries([{ ...summary('a'), programId: 'new-program' }]);
    expect(await listProgramSummaries()).toEqual([{ ...summary('a'), programId: 'new-program' }]);
  });

  it('preserves ordered last-write behavior for duplicate IDs', async () => {
    await upsertProgramSummaries([
      { ...summary('a', 'First'), programId: 'gzclp' },
      summary('a', 'Last'),
    ]);
    expect(await listProgramSummaries()).toEqual([{ ...summary('a', 'Last'), programId: 'gzclp' }]);
  });

  it('binds hostile IDs as data during pruning', async () => {
    const hostile = "x'); DELETE FROM program_summaries; --";
    await upsertProgramSummaries([summary(hostile), summary('kept')]);
    await upsertProgramSummaries([summary('kept')]);
    expect(await listProgramSummaries()).toEqual([summary('kept')]);
  });

  it('prunes multiple bounded batches and rolls every batch back on failure', async () => {
    const initial = Array.from({ length: 450 }, (_, index) =>
      summary(String(index).padStart(3, '0'))
    );
    await upsertProgramSummaries(initial);
    const run = database.runAsync;
    let deletes = 0;
    const spy = jest.spyOn(database, 'runAsync').mockImplementation(async (sql, ...params) => {
      if (sql.includes('DELETE')) {
        deletes += 1;
        if (deletes === 2) throw new Error('second batch failed');
      }
      return run(sql, ...params);
    });
    await expect(upsertProgramSummaries([summary('next')])).rejects.toThrow('second batch failed');
    expect(await listProgramSummaries()).toEqual(initial);
    spy.mockImplementation(run);
    await upsertProgramSummaries([summary('next')]);
    expect(await listProgramSummaries()).toEqual([summary('next')]);
    for (const [, ...params] of spy.mock.calls) expect(params.length).toBeLessThanOrEqual(201);
  });

  it('replaces snapshots larger than the SQLite bind-variable limit', async () => {
    const large = Array.from({ length: 33000 }, (_, index) => summary(`id-${index}`));
    await upsertProgramSummaries([summary('removed')]);
    await upsertProgramSummaries(large);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM program_summaries').get().count).toBe(
      33000
    );
    await upsertProgramSummaries([summary('id-0', 'Kept')]);
    expect(await listProgramSummaries()).toEqual([summary('id-0', 'Kept')]);
  });
});
