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
 * Runtime migration 2 intentionally uses parallel, owner-scoped tables. The
 * unowned v1 tables remain untouched until the complete version 5 migration
 * can quarantine them with the v1 queue after M3 adapts its runtime.
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

  CREATE TABLE IF NOT EXISTS mobile_v2_program_reconciliations (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    operation TEXT NOT NULL CHECK (operation IN ('create', 'manage', 'delete')),
    entity_id TEXT NOT NULL CHECK (length(entity_id) > 0),
    created_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, operation, entity_id)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS mobile_v2_program_summaries_owner_status
    ON mobile_v2_program_summaries(owner_user_id, status, updated_at DESC, id);
  CREATE INDEX IF NOT EXISTS mobile_v2_program_reconciliations_owner_created
    ON mobile_v2_program_reconciliations(owner_user_id, created_at, entity_id);
`;

export const MOBILE_V2_SNAPSHOT_METADATA_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS mobile_v2_program_snapshots (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    resource TEXT NOT NULL CHECK (resource IN ('library', 'catalog')),
    synced_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, resource)
  ) STRICT;

  INSERT OR IGNORE INTO mobile_v2_program_snapshots (owner_user_id, resource, synced_at)
  SELECT owner_user_id, 'catalog', MAX(updated_at)
  FROM mobile_v2_program_catalog
  GROUP BY owner_user_id;
`;

export const MOBILE_V2_RECONCILIATION_EXPECTATIONS_SQL = `
  ALTER TABLE mobile_v2_program_reconciliations
    ADD COLUMN expected_name TEXT
    CHECK (expected_name IS NULL OR length(expected_name) > 0);

  ALTER TABLE mobile_v2_program_reconciliations
    ADD COLUMN expected_status TEXT
    CHECK (
      expected_status IS NULL
      OR expected_status IN ('active', 'completed', 'archived')
    );

  ALTER TABLE mobile_v2_program_reconciliations
    ADD COLUMN expected_config_json TEXT
    CHECK (
      expected_config_json IS NULL
      OR (
        json_valid(expected_config_json)
        AND json_type(expected_config_json) = 'object'
      )
    );

  CREATE TRIGGER mobile_v2_program_reconciliation_expectation_insert
  BEFORE INSERT ON mobile_v2_program_reconciliations
  WHEN NOT (
    (
      NEW.operation = 'manage'
      AND (
        (
          NEW.expected_name IS NULL
          AND NEW.expected_status IS NULL
          AND NEW.expected_config_json IS NULL
        )
        OR (
          (NEW.expected_name IS NOT NULL)
          + (NEW.expected_status IS NOT NULL)
          + (NEW.expected_config_json IS NOT NULL) = 1
        )
      )
    )
    OR (
      NEW.operation IN ('create', 'delete')
      AND NEW.expected_name IS NULL
      AND NEW.expected_status IS NULL
      AND NEW.expected_config_json IS NULL
    )
  )
  BEGIN
    SELECT RAISE(ABORT, 'invalid program reconciliation expectation');
  END;

  CREATE TRIGGER mobile_v2_program_reconciliation_expectation_update
  BEFORE UPDATE OF operation, expected_name, expected_status, expected_config_json
  ON mobile_v2_program_reconciliations
  WHEN NOT (
    (
      NEW.operation = 'manage'
      AND (
        (
          NEW.expected_name IS NULL
          AND NEW.expected_status IS NULL
          AND NEW.expected_config_json IS NULL
        )
        OR (
          (NEW.expected_name IS NOT NULL)
          + (NEW.expected_status IS NOT NULL)
          + (NEW.expected_config_json IS NOT NULL) = 1
        )
      )
    )
    OR (
      NEW.operation IN ('create', 'delete')
      AND NEW.expected_name IS NULL
      AND NEW.expected_status IS NULL
      AND NEW.expected_config_json IS NULL
    )
  )
  BEGIN
    SELECT RAISE(ABORT, 'invalid program reconciliation expectation');
  END;
`;
