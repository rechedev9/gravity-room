/// <reference types="node" />

import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from './migrations';
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
});
