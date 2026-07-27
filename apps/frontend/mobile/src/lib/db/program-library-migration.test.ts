/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from './migrations';
import {
  MOBILE_V2_SCHEMA_CONTRACT_SQL,
  MOBILE_V2_SCHEMA_CONTRACT_VERSION,
} from './mobile-v2-schema-contract';
import { V1_DATABASE_ROWS_FIXTURE_SQL } from '../../testing/fixtures/mobile-v2-fixtures';

function requireMigration(version: number): string {
  const migration = MIGRATIONS.find((candidate) => candidate.version === version);
  if (!migration) {
    throw new Error(`Missing migration ${version}`);
  }
  return migration.sql;
}

function countRows(database: DatabaseSync, table: string): number {
  const row = database.prepare(`SELECT count(*) AS count FROM ${table}`).get();
  const count = row?.count;
  if (typeof count !== 'number') {
    throw new Error(`Expected row count for ${table}`);
  }
  return count;
}

describe('M2 program-library migration', () => {
  it('creates only owner-scoped program tables while preserving every unowned v1 row', () => {
    const database = new DatabaseSync(':memory:');
    database.exec(requireMigration(1));
    database.exec(V1_DATABASE_ROWS_FIXTURE_SQL);
    database.exec('PRAGMA user_version = 1');

    database.exec('BEGIN IMMEDIATE');
    database.exec(requireMigration(2));
    database.exec('PRAGMA user_version = 2');
    database.exec('COMMIT');

    expect(countRows(database, 'program_summaries')).toBe(1);
    expect(countRows(database, 'program_details')).toBe(1);
    expect(countRows(database, 'program_definitions')).toBe(1);
    expect(countRows(database, 'queued_mutations')).toBe(1);
    expect(countRows(database, 'mobile_v2_program_summaries')).toBe(0);
    expect(countRows(database, 'mobile_v2_program_details')).toBe(0);
    expect(countRows(database, 'mobile_v2_program_definitions')).toBe(0);
    expect(countRows(database, 'mobile_v2_program_catalog')).toBe(0);
    expect(countRows(database, 'mobile_v2_program_preferences')).toBe(0);

    database.close();
  });

  it('enforces owner and lifecycle isolation at the SQLite boundary', () => {
    const database = new DatabaseSync(':memory:');
    database.exec(requireMigration(1));
    database.exec(requireMigration(2));

    database.exec(`
      INSERT INTO mobile_v2_program_summaries (
        owner_user_id, id, program_id, title, status, created_at, updated_at
      ) VALUES (
        'user-a', 'program-a', 'gzclp', 'A private', 'active',
        '2026-07-27T10:00:00.000Z', '2026-07-27T10:00:00.000Z'
      )
    `);

    expect(countRows(database, 'mobile_v2_program_summaries')).toBe(1);
    expect(() =>
      database.exec(`
        INSERT INTO mobile_v2_program_summaries (
          owner_user_id, id, program_id, title, status, created_at, updated_at
        ) VALUES (
          '', 'program-b', 'gzclp', 'Invalid owner', 'active',
          '2026-07-27T10:00:00.000Z', '2026-07-27T10:00:00.000Z'
        )
      `)
    ).toThrow();
    expect(() =>
      database.exec(`
        INSERT INTO mobile_v2_program_summaries (
          owner_user_id, id, program_id, title, status, created_at, updated_at
        ) VALUES (
          'user-b', 'program-b', 'gzclp', 'Invalid status', 'paused',
          '2026-07-27T10:00:00.000Z', '2026-07-27T10:00:00.000Z'
        )
      `)
    ).toThrow();

    database.close();
  });

  it('composes v1 with rows through M2 and the complete future M3 contract', () => {
    const database = new DatabaseSync(':memory:');
    database.exec(requireMigration(1));
    database.exec(V1_DATABASE_ROWS_FIXTURE_SQL);
    database.exec(requireMigration(2));
    database.exec(`
      INSERT INTO mobile_v2_program_summaries (
        owner_user_id, id, program_id, title, status, created_at, updated_at
      ) VALUES (
        'owner-a', 'owned-program', 'gzclp', 'Owned program', 'active',
        '2026-07-27T10:00:00.000Z', '2026-07-27T10:00:00.000Z'
      );
      INSERT INTO mobile_v2_program_preferences (
        owner_user_id, pinned_program_id, updated_at
      ) VALUES (
        'owner-a', 'owned-program', '2026-07-27T10:00:00.000Z'
      );
      PRAGMA user_version = 2;
    `);

    database.exec('BEGIN IMMEDIATE');
    database.exec(MOBILE_V2_SCHEMA_CONTRACT_SQL);
    database.exec(`PRAGMA user_version = ${MOBILE_V2_SCHEMA_CONTRACT_VERSION}`);
    database.exec('COMMIT');

    expect(
      database
        .prepare(
          `SELECT title
           FROM program_summaries
           WHERE owner_user_id = 'owner-a' AND id = 'owned-program'`
        )
        .get()?.title
    ).toBe('Owned program');
    expect(
      database
        .prepare(
          `SELECT pinned_program_id
           FROM program_preferences
           WHERE owner_user_id = 'owner-a'`
        )
        .get()?.pinned_program_id
    ).toBe('owned-program');
    expect(countRows(database, 'legacy_user_cache_quarantine')).toBe(3);
    expect(countRows(database, 'legacy_queued_mutations_quarantine')).toBe(1);
    expect(countRows(database, 'outbox_mutations')).toBe(0);
    expect(countRows(database, 'workout_sessions')).toBe(0);
    expect(countRows(database, 'workout_set_logs')).toBe(0);
    expect(database.prepare('PRAGMA user_version').get()?.user_version).toBe(
      MOBILE_V2_SCHEMA_CONTRACT_VERSION
    );

    database.close();
  });
});
