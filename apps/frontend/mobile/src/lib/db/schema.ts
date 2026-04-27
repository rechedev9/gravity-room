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
