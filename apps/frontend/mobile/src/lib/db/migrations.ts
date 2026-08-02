import {
  PROGRAM_DEFINITIONS_TABLE_SQL,
  PROGRAM_DETAILS_TABLE_SQL,
  PROGRAM_SUMMARIES_TABLE_SQL,
  QUEUED_MUTATIONS_TABLE_SQL,
} from './schema';

export interface MigrationStep {
  readonly version: number;
  readonly sql: string;
}

/**
 * Ordered, versioned schema migrations applied against `PRAGMA user_version`.
 *
 * Migration 1 captures the schema as it exists today (all `CREATE TABLE IF
 * NOT EXISTS` statements). Keeping `IF NOT EXISTS` here is intentional: an
 * install that already has these tables but `user_version = 0` (i.e. every
 * install that predates this migration mechanism) converges safely to
 * version 1 without erroring, while a fresh install creates the tables from
 * scratch.
 *
 * Add future schema changes as new steps with an incrementing `version`.
 * Never edit a step that has already shipped — append a new one instead.
 */
const LEGACY_BASELINE_SQL = `
  CREATE TABLE IF NOT EXISTS program_summaries (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS queued_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS program_details (
    id TEXT PRIMARY KEY NOT NULL,
    program_id TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS program_definitions (
    id TEXT PRIMARY KEY NOT NULL,
    definition_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

/**
 * Version 3 intentionally discards the legacy, unowned cache/outbox. There is
 * no trustworthy way to infer which account owned those rows. Preserving them
 * under the next account would recreate the cross-account disclosure this
 * migration fixes. Server-backed cache rows can be re-fetched; unowned queued
 * mutations must not be replayed with a different account's credentials.
 */
const OWNER_PARTITION_MIGRATION_SQL = `
  DROP TABLE IF EXISTS queued_mutations;
  DROP TABLE IF EXISTS program_details;
  DROP TABLE IF EXISTS program_definitions;
  DROP TABLE IF EXISTS program_summaries;
  ${PROGRAM_SUMMARIES_TABLE_SQL}
  ${QUEUED_MUTATIONS_TABLE_SQL}
  ${PROGRAM_DETAILS_TABLE_SQL}
  ${PROGRAM_DEFINITIONS_TABLE_SQL}
`;

export const MIGRATIONS: readonly MigrationStep[] = [
  {
    version: 1,
    sql: LEGACY_BASELINE_SQL,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE queued_mutations ADD COLUMN dedupe_key TEXT;
      CREATE INDEX queued_mutations_dedupe_key_idx
        ON queued_mutations (dedupe_key);
    `,
  },
  {
    version: 3,
    sql: OWNER_PARTITION_MIGRATION_SQL,
  },
];
