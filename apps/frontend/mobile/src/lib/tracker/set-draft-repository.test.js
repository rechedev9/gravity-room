const { DatabaseSync } = require('node:sqlite');
const client = require('../db/client');
const { getSetDrafts, saveSetDrafts } = require('./set-draft-repository');
const { upsertProgramDetail } = require('./program-detail-repository');

// Exercise the production SQL and migrations against SQLite, including rollback.
describe('set drafts in SQLite', () => {
  let sqlite;
  let database;

  beforeEach(async () => {
    sqlite = new DatabaseSync(':memory:');
    database = {
      execAsync: async (sql) => {
        sqlite.exec(sql);
      },
      runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
      getAllAsync: async (sql, ...params) => sqlite.prepare(sql).all(...params),
      withExclusiveTransactionAsync: async (task) => {
        sqlite.exec('BEGIN EXCLUSIVE');
        try {
          await task(database);
          sqlite.exec('COMMIT');
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    };
    jest.spyOn(client, 'getDatabase').mockReturnValue(database);
    await client.activateLocalDataOwner('athlete-a', database);
  });

  afterEach(() => {
    client.deactivateLocalDataOwner();
    jest.restoreAllMocks();
    sqlite.close();
  });

  it('persists, replaces and removes drafts independently per account and program', async () => {
    const draft = { '0:squat': [{ reps: 3, weight: 60 }] };
    await saveSetDrafts('program-a', draft);
    await saveSetDrafts('program-b', draft);
    expect(await getSetDrafts('program-a')).toEqual(draft);
    await client.activateLocalDataOwner('athlete-b', database);
    expect(await getSetDrafts('program-a')).toEqual({});
    await saveSetDrafts('program-a', { '1:bench': [{ reps: 5 }] });
    await client.activateLocalDataOwner('athlete-a', database);
    expect(await getSetDrafts('program-a')).toEqual(draft);
    await saveSetDrafts('program-a', {});
    expect(await getSetDrafts('program-a')).toEqual({});
    expect(await getSetDrafts('program-b')).toEqual(draft);
  });

  it('preserves the old snapshot after a failed insert', async () => {
    const draft = { '0:squat': [{ reps: 3 }] };
    await saveSetDrafts('program-a', draft);
    sqlite.exec(`CREATE TRIGGER reject_draft BEFORE INSERT ON set_drafts
      BEGIN SELECT RAISE(ABORT, 'disk write failed'); END`);
    await expect(saveSetDrafts('program-a', { '0:squat': [{ reps: 4 }] })).rejects.toThrow();
    expect(await getSetDrafts('program-a')).toEqual(draft);
  });

  it('rejects invalid entries before deleting existing drafts', async () => {
    const draft = { '0:squat': [{ reps: 3 }] };
    await saveSetDrafts('program-a', draft);
    await expect(saveSetDrafts('program-a', { '0:squat': [{ reps: -1 }] })).rejects.toThrow();
    expect(await getSetDrafts('program-a')).toEqual(draft);
  });

  it('commits a completed result and draft removal together', async () => {
    const draft = { '0:squat': [{ reps: 3 }] };
    await saveSetDrafts('program-a', draft);
    const detail = {
      id: 'program-a',
      programId: 'gzclp',
      updatedAt: '2026-09-04T00:00:00Z',
      results: { 0: { squat: { result: 'success', setLogs: [{ reps: 3 }] } } },
    };
    sqlite.exec(`CREATE TRIGGER reject_clear BEFORE DELETE ON set_drafts
      BEGIN SELECT RAISE(ABORT, 'disk write failed'); END`);
    await expect(upsertProgramDetail(detail)).rejects.toThrow();
    expect(await getSetDrafts('program-a')).toEqual(draft);
    expect(sqlite.prepare('SELECT * FROM program_details').all()).toEqual([]);
    sqlite.exec('DROP TRIGGER reject_clear');
    await upsertProgramDetail(detail);
    expect(await getSetDrafts('program-a')).toEqual({});
    expect(sqlite.prepare('SELECT * FROM program_details').all()).toHaveLength(1);
  });

  it('rolls back a write if the account changes during the transaction', async () => {
    const draft = { '0:squat': [{ reps: 3 }] };
    await saveSetDrafts('program-a', draft);
    const run = database.runAsync;
    jest.spyOn(database, 'runAsync').mockImplementationOnce(async (...args) => {
      const result = await run(...args);
      client.deactivateLocalDataOwner();
      return result;
    });
    await expect(saveSetDrafts('program-a', {})).rejects.toThrow('not been validated');
    await client.activateLocalDataOwner('athlete-a', database);
    expect(await getSetDrafts('program-a')).toEqual(draft);
  });

  it('fails closed without an active account and erases all partitions on logout', async () => {
    await saveSetDrafts('program-a', { '0:squat': [{ reps: 3 }] });
    client.deactivateLocalDataOwner();
    await expect(getSetDrafts('program-a')).rejects.toThrow('not been validated');
    await expect(saveSetDrafts('program-a', {})).rejects.toThrow('not been validated');
    await client.clearLocalAppData(database);
    expect(sqlite.prepare('SELECT * FROM set_drafts').all()).toEqual([]);
  });
});
