export const PROGRAM_SUMMARIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS program_summaries (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const QUEUED_MUTATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS queued_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

export const PROGRAM_DETAILS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS program_details (
    id TEXT PRIMARY KEY NOT NULL,
    program_id TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

export const PROGRAM_DEFINITIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS program_definitions (
    id TEXT PRIMARY KEY NOT NULL,
    definition_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

/**
 * M2 intentionally uses parallel, owner-scoped tables. The unowned v1 tables
 * remain untouched until the full v2 migration can quarantine them together
 * with the v1 queue after M3 adapts its runtime.
 */
export const MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS mobile_v2_program_summaries (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    id TEXT NOT NULL CHECK (length(id) > 0),
    program_id TEXT NOT NULL CHECK (length(program_id) > 0),
    title TEXT NOT NULL CHECK (length(title) > 0),
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS mobile_v2_program_details (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    id TEXT NOT NULL CHECK (length(id) > 0),
    program_id TEXT NOT NULL CHECK (length(program_id) > 0),
    detail_json TEXT NOT NULL CHECK (
      json_valid(detail_json) AND json_type(detail_json) = 'object'
    ),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS mobile_v2_program_definitions (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    id TEXT NOT NULL CHECK (length(id) > 0),
    definition_json TEXT NOT NULL CHECK (
      json_valid(definition_json) AND json_type(definition_json) = 'object'
    ),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS mobile_v2_program_catalog (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    id TEXT NOT NULL CHECK (length(id) > 0),
    entry_json TEXT NOT NULL CHECK (
      json_valid(entry_json) AND json_type(entry_json) = 'object'
    ),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS mobile_v2_program_preferences (
    owner_user_id TEXT PRIMARY KEY NOT NULL CHECK (length(owner_user_id) > 0),
    pinned_program_id TEXT,
    updated_at TEXT NOT NULL,
    CHECK (pinned_program_id IS NULL OR length(pinned_program_id) > 0)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS mobile_v2_program_summaries_owner_status
    ON mobile_v2_program_summaries(owner_user_id, status, updated_at DESC, id);
`;
