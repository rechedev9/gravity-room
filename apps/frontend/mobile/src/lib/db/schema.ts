export const PROGRAM_SUMMARIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS program_summaries (
    owner_user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  );
`;

export const QUEUED_MUTATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS queued_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    dedupe_key TEXT
  );

  CREATE INDEX IF NOT EXISTS queued_mutations_owner_created_idx
    ON queued_mutations (owner_user_id, created_at, id);
  CREATE INDEX IF NOT EXISTS queued_mutations_owner_dedupe_idx
    ON queued_mutations (owner_user_id, dedupe_key);
`;

export const PROGRAM_DETAILS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS program_details (
    owner_user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    program_id TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  );
`;

export const PROGRAM_DEFINITIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS program_definitions (
    owner_user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    definition_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  );
`;
