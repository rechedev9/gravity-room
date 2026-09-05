const { parseRetryAfter } = require('../network/retry-after');
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
  enqueueMutation,
  markQueuedMutationFailure,
  acknowledgeQueuedMutations,
} = require('../sync/mutation-queue-repository');

const {
  readSyncBackoff,
  recordSyncBackoff,
  clearSyncBackoff,
} = require('../sync/sync-backoff-repository');

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

  it('drains bounded FIFO pages even when the device clock moves backwards', async () => {
    for (let index = 0; index < 63; index += 1) {
      await enqueueMutation({
        entityType: 'program-instance',
        entityId: `plan-${index}`,
        operation: 'delete-result',
        payload: TARGET,
        createdAt: index < 20 ? '2026-09-05T00:00:00Z' : '2020-01-01T00:00:00Z',
      });
    }
    const first = await listQueuedMutations();
    expect(first).toHaveLength(50);
    expect(first.map((row) => row.entityId)).toEqual(
      Array.from({ length: 50 }, (_, index) => `plan-${index}`)
    );
    // Read beyond a retained first page without acknowledging its rows.
    const second = await listQueuedMutations('owner-a', first.at(-1).id);
    expect(second.map((row) => row.entityId)).toEqual(
      Array.from({ length: 13 }, (_, index) => `plan-${index + 50}`)
    );
  });

  it('persists and queues a valid workout beyond index 999 without losing earlier results', async () => {
    const detail = {
      ...COMPLETE,
      results: { ...COMPLETE.results, 1000: { squat: { result: 'success', amrapReps: 999 } } },
    };
    await commitTrackerEdit(detail, { workoutIndex: 1000, slotId: 'squat' });
    expect(await getProgramDetail(BASE.id)).toEqual(detail);
    expect(await listQueuedMutations()).toEqual([
      expect.objectContaining({
        operation: 'record-result',
        payload: { workoutIndex: 1000, slotId: 'squat', result: 'success', amrapReps: 999 },
      }),
    ]);
  });

  it.each([
    { results: { 0: { squat: { result: 'success', amrapReps: 1000 } } } },
    { undoHistory: [{ i: -1, slotId: 'squat' }] },
    { config: { squat: null } },
    { completedDates: { 0: false } },
  ])(
    'rejects invalid write data instead of replacing it with hydration defaults: %j',
    async (invalid) => {
      await commitTrackerEdit(COMPLETE, TARGET);
      const pending = await listQueuedMutations();
      await expect(commitTrackerEdit({ ...COMPLETE, ...invalid }, TARGET)).rejects.toThrow();
      expect(await getProgramDetail(BASE.id)).toEqual(COMPLETE);
      expect(await listQueuedMutations()).toEqual(pending);
    }
  );

  it('keeps a failure diagnostic across restart and protects a replacement from stale failures', async () => {
    await commitTrackerEdit(COMPLETE, TARGET);
    const [old] = await listQueuedMutations();
    await markQueuedMutationFailure(old.id, 'HTTP_403');
    sqlite.close();
    open();
    await client.activateLocalDataOwner('owner-a', database);
    expect(await listQueuedMutations()).toEqual([
      expect.objectContaining({ lastErrorCode: 'HTTP_403' }),
    ]);
    await markQueuedMutationFailure(old.id, 'HTTP_500', 'owner-b');
    expect(await listQueuedMutations()).toEqual([
      expect.objectContaining({ lastErrorCode: 'HTTP_403' }),
    ]);
    await commitTrackerEdit(BASE, TARGET);
    await markQueuedMutationFailure(old.id, 'HTTP_500');
    expect(await listQueuedMutations()).toEqual([
      expect.objectContaining({ operation: 'delete-result' }),
    ]);
    expect((await listQueuedMutations())[0].lastErrorCode).toBeUndefined();
  });

  it('persists owner-wide retry pauses across restart and rebases a backwards clock once', async () => {
    const now = 1788600000000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(await recordSyncBackoff('owner-a')).toBe(now + 5000);
    expect(await recordSyncBackoff('owner-a')).toBe(now + 10000);
    expect(await recordSyncBackoff('owner-a', now + 60000)).toBe(now + 60000);
    sqlite.close();
    open();
    await client.activateLocalDataOwner('owner-a', database);
    expect(await readSyncBackoff('owner-a')).toBe(now + 60000);
    expect(await readSyncBackoff('owner-b')).toBe(0);
    clock.mockReturnValue(now - 3600000);
    expect(await readSyncBackoff('owner-a')).toBe(now - 3600000 + 60000);
    expect(await readSyncBackoff('owner-a')).toBe(now - 3600000 + 60000);
    await clearSyncBackoff('owner-b');
    expect(await readSyncBackoff('owner-a')).toBe(now - 3600000 + 60000);
    await clearSyncBackoff('owner-a');
    expect(await readSyncBackoff('owner-a')).toBe(0);
  });

  it('does not let a cancelled attempt erase or replace a newer retry pause', async () => {
    const future = Date.now() + 60000;
    await recordSyncBackoff('owner-a', future);
    const controller = new AbortController();
    controller.abort();
    await expect(clearSyncBackoff('owner-a', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    await expect(
      recordSyncBackoff('owner-a', future + 60000, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(await readSyncBackoff('owner-a')).toBe(future);
  });

  it('parses server retry seconds and HTTP dates without overflowing timers', () => {
    const now = Date.parse('2026-09-05T10:00:00Z');
    expect(parseRetryAfter('60', now)).toBe(now + 60000);
    expect(parseRetryAfter('Sat, 05 Sep 2026 10:01:00 GMT', now)).toBe(now + 60000);
    for (const invalid of [null, '', '-1', 'bad', '999999999999999999999999']) {
      expect(parseRetryAfter(invalid, now)).toBe(0);
    }
  });

  it('rejects malformed edits before changing data', async () => {
    await expect(commitTrackerEdit(COMPLETE, { ...TARGET, workoutIndex: -1 })).rejects.toThrow();
    expect(await getProgramDetail(BASE.id)).toEqual(BASE);
    expect(await getSetDrafts(BASE.id)).toEqual({ '0:squat': LOGS });
  });
});
