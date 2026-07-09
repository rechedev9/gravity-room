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
export const MIGRATIONS: readonly MigrationStep[] = [
  {
    version: 1,
    sql: [
      PROGRAM_SUMMARIES_TABLE_SQL,
      QUEUED_MUTATIONS_TABLE_SQL,
      PROGRAM_DETAILS_TABLE_SQL,
      PROGRAM_DEFINITIONS_TABLE_SQL,
    ].join('\n'),
  },
];
