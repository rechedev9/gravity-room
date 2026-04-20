export const PROGRAM_SUMMARIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS program_summaries (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;
