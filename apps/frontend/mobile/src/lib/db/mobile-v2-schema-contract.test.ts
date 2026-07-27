/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';

import {
  MOBILE_V2_SCHEMA_CONTRACT_SQL,
  MOBILE_V2_SCHEMA_CONTRACT_VERSION,
} from './mobile-v2-schema-contract';
import { MIGRATIONS } from './migrations';
import { V1_DATABASE_ROWS_FIXTURE_SQL } from '../../testing/fixtures/mobile-v2-fixtures';

function readNumber(database: DatabaseSync, source: string, column: string): number {
  const row = database.prepare(source).get();
  const value = row?.[column];

  if (typeof value !== 'number') {
    throw new Error(`Expected numeric SQLite column ${column}`);
  }

  return value;
}

function readStrings(database: DatabaseSync, source: string, column: string): string[] {
  return database
    .prepare(source)
    .all()
    .map((row) => row[column])
    .map((value) => {
      if (typeof value !== 'string') {
        throw new Error(`Expected string SQLite column ${column}`);
      }

      return value;
    });
}

function createV1Database(withRows: boolean): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  const baseline = MIGRATIONS.find((migration) => migration.version === 1);

  if (!baseline) {
    throw new Error('The frozen v1 migration is missing');
  }

  database.exec('PRAGMA foreign_keys = ON');
  database.exec(baseline.sql);
  database.exec('PRAGMA user_version = 1');

  if (withRows) {
    database.exec(V1_DATABASE_ROWS_FIXTURE_SQL);
  }

  return database;
}

function applyContractMigration(
  database: DatabaseSync,
  afterSql: () => void = () => undefined
): boolean {
  const currentVersion = readNumber(database, 'PRAGMA user_version', 'user_version');

  if (currentVersion >= MOBILE_V2_SCHEMA_CONTRACT_VERSION) {
    return false;
  }

  database.exec('BEGIN IMMEDIATE');

  try {
    database.exec(MOBILE_V2_SCHEMA_CONTRACT_SQL);
    afterSql();
    database.exec(`PRAGMA user_version = ${MOBILE_V2_SCHEMA_CONTRACT_VERSION}`);
    database.exec('COMMIT');
    return true;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function countRows(database: DatabaseSync, table: string, where = ''): number {
  return readNumber(database, `SELECT count(*) AS count FROM ${table} ${where}`, 'count');
}

describe('Mobile v2 SQLite schema contract', () => {
  it('runs the exact SQL on an empty v1 database and creates the contractual schema', () => {
    const database = createV1Database(false);

    expect(applyContractMigration(database)).toBe(true);
    expect(readNumber(database, 'PRAGMA user_version', 'user_version')).toBe(2);
    expect(
      readStrings(
        database,
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        'name'
      )
    ).toEqual([
      'legacy_queued_mutations_quarantine',
      'legacy_user_cache_quarantine',
      'outbox_mutations',
      'program_definitions',
      'program_details',
      'program_summaries',
      'sqlite_sequence',
      'workout_sessions',
      'workout_set_logs',
    ]);
    expect(
      readStrings(
        database,
        "SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name",
        'name'
      )
    ).toEqual([
      'legacy_queue_claim_state',
      'legacy_user_cache_claim_state',
      'one_in_progress_session_per_owner',
      'outbox_mutations_owner_schedule',
      'workout_sessions_owner_program_updated',
      'workout_set_logs_session_position',
    ]);
    expect(countRows(database, 'program_summaries')).toBe(0);
    expect(countRows(database, 'outbox_mutations')).toBe(0);

    database.close();
  });

  it('quarantines every unowned v1 row without attributing or replaying it', () => {
    const database = createV1Database(true);

    applyContractMigration(database);

    expect(
      readStrings(
        database,
        'SELECT quarantine_key FROM legacy_user_cache_quarantine ORDER BY quarantine_key',
        'quarantine_key'
      )
    ).toEqual([
      'v1-cache:program-definition:mobile-v2-baseline',
      'v1-cache:program-detail:11111111-1111-4111-8111-111111111111',
      'v1-cache:program-summary:11111111-1111-4111-8111-111111111111',
    ]);
    expect(
      readStrings(
        database,
        'SELECT quarantine_key FROM legacy_queued_mutations_quarantine',
        'quarantine_key'
      )
    ).toEqual(['v1-queue:0000000000000001']);
    expect(
      countRows(
        database,
        'legacy_user_cache_quarantine',
        'WHERE validated_owner_user_id IS NOT NULL'
      )
    ).toBe(0);
    expect(
      countRows(
        database,
        'legacy_queued_mutations_quarantine',
        'WHERE validated_owner_user_id IS NOT NULL'
      )
    ).toBe(0);
    expect(countRows(database, 'program_summaries')).toBe(0);
    expect(countRows(database, 'program_details')).toBe(0);
    expect(countRows(database, 'program_definitions')).toBe(0);
    expect(countRows(database, 'outbox_mutations')).toBe(0);

    expect(() =>
      database.exec(`
        UPDATE legacy_queued_mutations_quarantine
        SET claim_state = 'validated', validated_owner_user_id = 'user-a'
      `)
    ).toThrow();
    expect(() =>
      database.exec(`
        UPDATE legacy_queued_mutations_quarantine
        SET
          claim_state = 'validated',
          validated_owner_user_id = 'user-a',
          server_ownership_proof = 'server-revision-7',
          validated_at = '2026-07-27T09:00:00.000Z'
      `)
    ).not.toThrow();
    expect(countRows(database, 'outbox_mutations')).toBe(0);

    database.close();
  });

  it('keeps user B isolated after user A writes and logout fails offline', () => {
    const database = createV1Database(true);
    applyContractMigration(database);

    database.exec(`
      INSERT INTO program_summaries (owner_user_id, id, title, updated_at)
      VALUES (
        'user-a',
        '11111111-1111-4111-8111-111111111111',
        'A private program',
        '2026-07-27T10:00:00.000Z'
      );
      INSERT INTO outbox_mutations (
        id,
        owner_user_id,
        entity_type,
        entity_id,
        operation,
        payload_json,
        next_attempt_at,
        created_at,
        updated_at
      )
      VALUES (
        '44444444-4444-4444-8444-444444444444',
        'user-a',
        'program_instance',
        '11111111-1111-4111-8111-111111111111',
        'update',
        '{"name":"A private program"}',
        '2026-07-27T10:00:05.000Z',
        '2026-07-27T10:00:00.000Z',
        '2026-07-27T10:00:00.000Z'
      );
    `);

    // A failed remote logout leaves A's local rows intact. Selecting the
    // authenticated partition for B still exposes and replays nothing.
    expect(countRows(database, 'program_summaries', "WHERE owner_user_id = 'user-b'")).toBe(0);
    expect(countRows(database, 'outbox_mutations', "WHERE owner_user_id = 'user-b'")).toBe(0);
    expect(countRows(database, 'program_summaries', "WHERE owner_user_id = 'user-a'")).toBe(1);
    expect(countRows(database, 'outbox_mutations', "WHERE owner_user_id = 'user-a'")).toBe(1);

    database.close();
  });

  it('enforces workout lifecycle, enum, boolean, foreign-key and active-session invariants', () => {
    const database = createV1Database(false);
    applyContractMigration(database);

    database.exec(`
      INSERT INTO workout_sessions (
        id,
        owner_user_id,
        program_instance_id,
        workout_index,
        status,
        started_at,
        completed_at,
        updated_at
      )
      VALUES (
        '55555555-5555-4555-8555-555555555555',
        'user-a',
        '11111111-1111-4111-8111-111111111111',
        0,
        'in_progress',
        '2026-07-27T10:00:00.000Z',
        NULL,
        '2026-07-27T10:00:00.000Z'
      );
      INSERT INTO workout_set_logs (
        id,
        session_id,
        slot_id,
        position,
        kind,
        reps,
        weight_kg,
        rpe,
        is_amrap,
        updated_at
      )
      VALUES (
        '66666666-6666-4666-8666-666666666666',
        '55555555-5555-4555-8555-555555555555',
        'squat-t1',
        0,
        'working',
        5,
        60,
        8,
        1,
        '2026-07-27T10:01:00.000Z'
      );
    `);

    expect(() =>
      database.exec(`
        INSERT INTO workout_sessions (
          id, owner_user_id, program_instance_id, workout_index, status,
          started_at, completed_at, updated_at
        ) VALUES (
          '77777777-7777-4777-8777-777777777777', 'user-a', 'program-2', 1,
          'in_progress', '2026-07-27T11:00:00.000Z', NULL, '2026-07-27T11:00:00.000Z'
        )
      `)
    ).toThrow();
    expect(() =>
      database.exec(`
        INSERT INTO workout_sessions (
          id, owner_user_id, program_instance_id, workout_index, status,
          started_at, completed_at, updated_at
        ) VALUES (
          '77777777-7777-4777-8777-777777777777', 'user-b', 'program-2', 1,
          'completed', '2026-07-27T11:00:00.000Z', NULL, '2026-07-27T11:00:00.000Z'
        )
      `)
    ).toThrow();
    expect(() =>
      database.exec(`
        INSERT INTO workout_sessions (
          id, owner_user_id, program_instance_id, workout_index, status,
          started_at, completed_at, updated_at
        ) VALUES (
          '77777777-7777-4777-8777-777777777777', 'user-b', 'program-2', 1,
          'paused', '2026-07-27T11:00:00.000Z', NULL, '2026-07-27T11:00:00.000Z'
        )
      `)
    ).toThrow();
    expect(() =>
      database.exec(`
        INSERT INTO workout_set_logs (
          id, session_id, slot_id, position, kind, reps, is_amrap, updated_at
        ) VALUES (
          '88888888-8888-4888-8888-888888888888',
          '55555555-5555-4555-8555-555555555555',
          'squat-t1', 1, 'drop', 5, 0, '2026-07-27T10:02:00.000Z'
        )
      `)
    ).toThrow();
    expect(() =>
      database.exec(`
        INSERT INTO workout_set_logs (
          id, session_id, slot_id, position, kind, reps, is_amrap, updated_at
        ) VALUES (
          '88888888-8888-4888-8888-888888888888',
          '55555555-5555-4555-8555-555555555555',
          'squat-t1', 1, 'warmup', 5, 2, '2026-07-27T10:02:00.000Z'
        )
      `)
    ).toThrow();
    expect(() =>
      database.exec(`
        INSERT INTO workout_set_logs (
          id, session_id, slot_id, position, kind, reps, is_amrap, updated_at
        ) VALUES (
          '88888888-8888-4888-8888-888888888888',
          '99999999-9999-4999-8999-999999999999',
          'squat-t1', 1, 'warmup', 5, 0, '2026-07-27T10:02:00.000Z'
        )
      `)
    ).toThrow();

    database.exec(`
      DELETE FROM workout_sessions
      WHERE id = '55555555-5555-4555-8555-555555555555'
    `);
    expect(countRows(database, 'workout_set_logs')).toBe(0);

    database.close();
  });

  it('rejects open-ended outbox operations and malformed payloads', () => {
    const database = createV1Database(false);
    applyContractMigration(database);

    expect(() =>
      database.exec(`
        INSERT INTO outbox_mutations (
          id, owner_user_id, entity_type, entity_id, operation, payload_json,
          next_attempt_at, created_at, updated_at
        ) VALUES (
          '99999999-9999-4999-8999-999999999999',
          'user-a',
          'workout_set',
          'set-a',
          'complete',
          '{}',
          '2026-07-27T10:00:00.000Z',
          '2026-07-27T10:00:00.000Z',
          '2026-07-27T10:00:00.000Z'
        )
      `)
    ).toThrow();
    expect(() =>
      database.exec(`
        INSERT INTO outbox_mutations (
          id, owner_user_id, entity_type, entity_id, operation, payload_json,
          next_attempt_at, created_at, updated_at
        ) VALUES (
          '99999999-9999-4999-8999-999999999999',
          'user-a',
          'workout_set',
          'set-a',
          'upsert',
          'not-json',
          '2026-07-27T10:00:00.000Z',
          '2026-07-27T10:00:00.000Z',
          '2026-07-27T10:00:00.000Z'
        )
      `)
    ).toThrow();

    database.close();
  });

  it('rolls back all exact SQL changes and the version when the migration fails', () => {
    const database = createV1Database(true);

    expect(() =>
      applyContractMigration(database, () => {
        throw new Error('simulated storage failure before version commit');
      })
    ).toThrow('simulated storage failure');

    expect(readNumber(database, 'PRAGMA user_version', 'user_version')).toBe(1);
    expect(countRows(database, 'program_summaries')).toBe(1);
    expect(countRows(database, 'queued_mutations')).toBe(1);
    expect(
      countRows(
        database,
        'sqlite_master',
        "WHERE type = 'table' AND name = 'legacy_user_cache_quarantine'"
      )
    ).toBe(0);

    database.close();
  });

  it('is a no-op on the second version-gated execution', () => {
    const database = createV1Database(true);

    expect(applyContractMigration(database)).toBe(true);
    const schemaAfterFirstRun = readStrings(
      database,
      'SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name',
      'sql'
    );

    expect(applyContractMigration(database)).toBe(false);
    expect(
      readStrings(
        database,
        'SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name',
        'sql'
      )
    ).toEqual(schemaAfterFirstRun);
    expect(countRows(database, 'legacy_user_cache_quarantine')).toBe(3);
    expect(countRows(database, 'legacy_queued_mutations_quarantine')).toBe(1);

    database.close();
  });
});
