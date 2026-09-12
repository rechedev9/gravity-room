const { createSqliteTestAdapter } = require('../../../testing/sqlite-adapter.cjs');
const { DatabaseSync } = require('node:sqlite');
const client = require('../db/client');
const { readSyncStatus } = require('./sync-status-repository');
const {
  acknowledgeQueuedMutations,
  markQueuedMutationFailure,
} = require('./mutation-queue-repository');

describe('sync diagnostics in SQLite', () => {
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

  function enqueue(code, ownerId = 'owner-a') {
    return Number(
      sqlite
        .prepare(
          `INSERT INTO queued_mutations
      (owner_user_id, entity_type, entity_id, operation, payload_json, created_at, last_error_code)
      VALUES (?, 'program-instance', 'program', 'record-result', '{}', '2026-09-12', ?)`
        )
        .run(ownerId, code).lastInsertRowid
    );
  }

  it('returns an empty summary without inventing pending edits', async () => {
    expect(await readSyncStatus()).toEqual({ total: 0, needsAttention: 0 });
  });

  it('counts grouped diagnostics while isolating owner partitions', async () => {
    for (const code of [
      null,
      null,
      'HTTP_401',
      'HTTP_403',
      'HTTP_422',
      'INVALID_OUTBOX',
      'HTTP_408',
      'HTTP_425',
      'HTTP_429',
      'HTTP_503',
      'REQUEST_TIMEOUT',
      'NETWORK_ERROR',
    ])
      enqueue(code);
    enqueue('HTTP_403', 'owner-b');
    expect(await readSyncStatus()).toEqual({ total: 12, needsAttention: 4 });
    expect(await readSyncStatus('owner-b')).toEqual({ total: 1, needsAttention: 1 });
  });

  it('updates attention after a worker persists a diagnostic, then removes acknowledged rows', async () => {
    const id = enqueue(null);
    expect(await readSyncStatus()).toEqual({ total: 1, needsAttention: 0 });
    await markQueuedMutationFailure(id, 'HTTP_401', 'owner-a');
    expect(await readSyncStatus()).toEqual({ total: 1, needsAttention: 1 });
    await markQueuedMutationFailure(id, 'HTTP_503', 'owner-a');
    expect(await readSyncStatus()).toEqual({ total: 1, needsAttention: 0 });
    await acknowledgeQueuedMutations([id], 'owner-a');
    expect(await readSyncStatus()).toEqual({ total: 0, needsAttention: 0 });
  });

  it('does not remove or alter retained intent while summarizing errors', async () => {
    enqueue('INVALID_OUTBOX');
    enqueue('HTTP_409');
    const before = sqlite.prepare('SELECT * FROM queued_mutations ORDER BY id').all();
    await readSyncStatus();
    expect(sqlite.prepare('SELECT * FROM queued_mutations ORDER BY id').all()).toEqual(before);
  });

  it('rejects a failed database read rather than reporting successful sync', async () => {
    sqlite.exec('DROP TABLE queued_mutations');
    await expect(readSyncStatus()).rejects.toThrow();
  });
});
