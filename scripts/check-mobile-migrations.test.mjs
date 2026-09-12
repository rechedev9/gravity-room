import { createSqliteTestAdapter } from '../apps/frontend/mobile/testing/sqlite-adapter.cjs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { createMigrationRunner } from '../apps/frontend/mobile/src/lib/db/migration-runner.ts';
import { MIGRATIONS } from '../apps/frontend/mobile/src/lib/db/migrations.ts';

function openDatabase(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const client = createSqliteTestAdapter(sqlite);
  return { sqlite, client };
}

test('all shipped mobile migrations initialize SQLite once under concurrent callers', async (t) => {
  const { sqlite, client } = openDatabase(t);
  const migrate = createMigrationRunner();
  await Promise.all(Array.from({ length: 10 }, () => migrate(client, MIGRATIONS)));
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 7);
  for (const table of [
    'program_summaries',
    'program_details',
    'program_definitions',
    'queued_mutations',
    'set_drafts',
    'sync_backoff',
  ]) {
    assert.ok(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
    );
  }
});

test('upgrade from the owner-partitioned schema preserves pending edits', async (t) => {
  const { sqlite, client } = openDatabase(t);
  await createMigrationRunner()(client, MIGRATIONS.slice(0, 3));
  sqlite
    .prepare(
      `INSERT INTO queued_mutations
    (owner_user_id, entity_type, entity_id, operation, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run('owner', 'program-instance', 'program', 'record-result', '{}', '2026-09-12');
  // A fresh runner represents a later application process/version.
  await createMigrationRunner()(client, MIGRATIONS);
  const row = sqlite.prepare('SELECT * FROM queued_mutations').get();
  assert.equal(row.owner_user_id, 'owner');
  assert.equal(row.operation, 'record-result');
  assert.equal(row.last_error_code, null);
});

test('failed DDL rolls back while previously committed versions remain retryable', async (t) => {
  const { sqlite, client } = openDatabase(t);
  const migrate = createMigrationRunner();
  const baseline = { version: 1, sql: 'CREATE TABLE retained (id INTEGER);' };
  await assert.rejects(
    migrate(client, [
      baseline,
      {
        version: 2,
        sql: 'CREATE TABLE partial (id INTEGER); INSERT INTO missing VALUES (1);',
      },
    ])
  );
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 1);
  assert.equal(
    sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'partial'").get(),
    undefined
  );
  await migrate(client, [baseline, { version: 2, sql: 'CREATE TABLE partial (id INTEGER);' }]);
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 2);
});

test('an older app refuses a newer schema without deleting user data', async (t) => {
  const { sqlite, client } = openDatabase(t);
  sqlite.exec(
    'CREATE TABLE retained (id INTEGER); INSERT INTO retained VALUES (42); PRAGMA user_version = 99;'
  );
  await assert.rejects(createMigrationRunner()(client, MIGRATIONS), /newer than this app/);
  assert.equal(sqlite.prepare('SELECT id FROM retained').get().id, 42);
  assert.equal(sqlite.prepare('PRAGMA user_version').get().user_version, 99);
});
