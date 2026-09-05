const { DatabaseSync } = require('node:sqlite');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const client = require('../db/client');
const { commitTrackerEdit } = require('./commit-tracker-edit');
const { getProgramDetail, upsertProgramDetail } = require('./program-detail-repository');
const { getSetDrafts, saveSetDrafts } = require('./set-draft-repository');
const {
  listQueuedMutations,
  acknowledgeQueuedMutations,
} = require('../sync/mutation-queue-repository');

jest.mock('../auth/session', () => ({ getAccessToken: () => null }));
jest.mock('../sync/mutation-sync-service', () => ({ flushQueuedMutations: jest.fn() }));

const BASE = {
  id: 'plan-a',
  programId: 'gzclp',
  name: 'My plan',
  config: {},
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-09-05T00:00:00Z',
  updatedAt: '2026-09-05T00:00:00Z',
};
const TARGET = { workoutIndex: 0, slotId: 'squat' };
const LOGS = [{ reps: 5, weight: 60 }];
const COMPLETE = {
  ...BASE,
  results: { 0: { squat: { result: 'success', setLogs: LOGS } } },
  undoHistory: [{ i: 0, slotId: 'squat' }],
};

// Use the production migrations and SQL on a file, not a mock SQL interpreter.
describe('atomic local workout edits', () => {
  let sqlite;
  let directory;
  let database;
  function open() {
    sqlite = new DatabaseSync(join(directory, 'training.db'));
    database = {
      execAsync: async (sql) => sqlite.exec(sql),
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
    jest.spyOn(client, 'getDatabase').mockImplementation(() => database);
  }
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'gravity-atomic-'));
    open();
    await client.activateLocalDataOwner('owner-a', database);
    await upsertProgramDetail(BASE);
    await saveSetDrafts(BASE.id, { '0:squat': LOGS });
  });
  afterEach(() => {
    client.deactivateLocalDataOwner();
    jest.restoreAllMocks();
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('rolls back the result, undo history, and draft cleanup when outbox insertion fails', async () => {
    sqlite.exec(`CREATE TRIGGER reject_outbox BEFORE INSERT ON queued_mutations
      BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END`);
    await expect(commitTrackerEdit(COMPLETE, TARGET)).rejects.toThrow('simulated storage failure');
    expect(await getProgramDetail(BASE.id)).toEqual(BASE);
    expect(await getSetDrafts(BASE.id)).toEqual({ '0:squat': LOGS });
    expect(await listQueuedMutations()).toEqual([]);
  });

  it('retains the completed result and delivery intent after closing and reopening SQLite', async () => {
    await commitTrackerEdit(COMPLETE, TARGET);
    sqlite.close();
    open();
    await client.activateLocalDataOwner('owner-a', database);
    expect(await getProgramDetail(BASE.id)).toEqual(COMPLETE);
    expect(await getSetDrafts(BASE.id)).toEqual({});
    expect(await listQueuedMutations()).toEqual([
      expect.objectContaining({
        operation: 'record-result',
        entityId: BASE.id,
        payload: { ...TARGET, result: 'success', setLogs: LOGS },
      }),
    ]);
  });

  it('atomically restores undo and protects its replacement outbox row from an old acknowledgement', async () => {
    await commitTrackerEdit(COMPLETE, TARGET);
    const [old] = await listQueuedMutations();
    await commitTrackerEdit(BASE, TARGET);
    await acknowledgeQueuedMutations([old.id]);
    expect(await getProgramDetail(BASE.id)).toEqual(BASE);
    expect(await listQueuedMutations()).toEqual([
      expect.objectContaining({
        operation: 'delete-result',
        payload: TARGET,
      }),
    ]);
  });

  it('restores the previous outbox row if replacement fails', async () => {
    await commitTrackerEdit(COMPLETE, TARGET);
    const before = await listQueuedMutations();
    sqlite.exec(`CREATE TRIGGER reject_outbox BEFORE INSERT ON queued_mutations
      BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END`);
    await expect(commitTrackerEdit(BASE, TARGET)).rejects.toThrow();
    expect(await getProgramDetail(BASE.id)).toEqual(COMPLETE);
    expect(await listQueuedMutations()).toEqual(before);
  });

  it('rejects malformed edits before changing data', async () => {
    await expect(commitTrackerEdit(COMPLETE, { ...TARGET, workoutIndex: -1 })).rejects.toThrow();
    expect(await getProgramDetail(BASE.id)).toEqual(BASE);
    expect(await getSetDrafts(BASE.id)).toEqual({ '0:squat': LOGS });
  });
});
