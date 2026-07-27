import { MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL } from './schema';

/**
 * Contractual complete-schema migration reserved for M3.
 *
 * Runtime migration 2 installs the owner-scoped M2 program library beside the
 * still-operational v1 tracker queue. This version 3 step composes that shipped
 * state into the complete schema: it quarantines unowned v1 rows, promotes only
 * already-owned M2 rows, and creates sessions/outbox without claiming legacy
 * data. M3 can register this exact step after adapting its runtime repositories.
 */
export const MOBILE_V2_SCHEMA_CONTRACT_VERSION = 3;

export const MOBILE_V2_SCHEMA_CONTRACT_SQL = `
  ${MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL}

  CREATE TABLE IF NOT EXISTS legacy_user_cache_quarantine (
    quarantine_key TEXT PRIMARY KEY NOT NULL,
    source_table TEXT NOT NULL CHECK (
      source_table IN ('program_summaries', 'program_details', 'program_definitions')
    ),
    source_row_id TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK (
      json_valid(payload_json) AND json_type(payload_json) = 'object'
    ),
    claim_state TEXT NOT NULL DEFAULT 'quarantined' CHECK (
      claim_state IN ('quarantined', 'validated', 'rejected')
    ),
    validated_owner_user_id TEXT,
    server_ownership_proof TEXT,
    validated_at TEXT,
    CHECK (
      (
        claim_state = 'quarantined'
        AND validated_owner_user_id IS NULL
        AND server_ownership_proof IS NULL
        AND validated_at IS NULL
      )
      OR (
        claim_state = 'validated'
        AND length(validated_owner_user_id) > 0
        AND length(server_ownership_proof) > 0
        AND validated_at IS NOT NULL
      )
      OR (
        claim_state = 'rejected'
        AND validated_owner_user_id IS NULL
        AND length(server_ownership_proof) > 0
        AND validated_at IS NOT NULL
      )
    )
  ) STRICT;

  CREATE TABLE IF NOT EXISTS legacy_queued_mutations_quarantine (
    quarantine_key TEXT PRIMARY KEY NOT NULL,
    legacy_queue_id INTEGER NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    claim_state TEXT NOT NULL DEFAULT 'quarantined' CHECK (
      claim_state IN ('quarantined', 'validated', 'rejected')
    ),
    validated_owner_user_id TEXT,
    server_ownership_proof TEXT,
    validated_at TEXT,
    CHECK (
      (
        claim_state = 'quarantined'
        AND validated_owner_user_id IS NULL
        AND server_ownership_proof IS NULL
        AND validated_at IS NULL
      )
      OR (
        claim_state = 'validated'
        AND length(validated_owner_user_id) > 0
        AND length(server_ownership_proof) > 0
        AND validated_at IS NOT NULL
      )
      OR (
        claim_state = 'rejected'
        AND validated_owner_user_id IS NULL
        AND length(server_ownership_proof) > 0
        AND validated_at IS NOT NULL
      )
    )
  ) STRICT;

  INSERT OR IGNORE INTO legacy_user_cache_quarantine (
    quarantine_key,
    source_table,
    source_row_id,
    payload_json
  )
  SELECT
    'v1-cache:program-summary:' || id,
    'program_summaries',
    id,
    json_object('id', id, 'title', title, 'updatedAt', updated_at)
  FROM program_summaries;

  INSERT OR IGNORE INTO legacy_user_cache_quarantine (
    quarantine_key,
    source_table,
    source_row_id,
    payload_json
  )
  SELECT
    'v1-cache:program-detail:' || id,
    'program_details',
    id,
    json_object(
      'id',
      id,
      'programId',
      program_id,
      'detailJson',
      detail_json,
      'updatedAt',
      updated_at
    )
  FROM program_details;

  INSERT OR IGNORE INTO legacy_user_cache_quarantine (
    quarantine_key,
    source_table,
    source_row_id,
    payload_json
  )
  SELECT
    'v1-cache:program-definition:' || id,
    'program_definitions',
    id,
    json_object(
      'id',
      id,
      'definitionJson',
      definition_json,
      'updatedAt',
      updated_at
    )
  FROM program_definitions;

  INSERT OR IGNORE INTO legacy_queued_mutations_quarantine (
    quarantine_key,
    legacy_queue_id,
    entity_type,
    entity_id,
    operation,
    payload_json,
    created_at
  )
  SELECT
    printf('v1-queue:%016x', id),
    id,
    entity_type,
    entity_id,
    operation,
    payload_json,
    created_at
  FROM queued_mutations;

  DROP TABLE queued_mutations;
  DROP TABLE program_details;
  DROP TABLE program_definitions;
  DROP TABLE program_summaries;

  CREATE TABLE program_summaries (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    id TEXT NOT NULL CHECK (length(id) > 0),
    program_id TEXT NOT NULL CHECK (length(program_id) > 0),
    title TEXT NOT NULL CHECK (length(title) > 0),
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  ) STRICT;

  CREATE TABLE program_details (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    id TEXT NOT NULL CHECK (length(id) > 0),
    program_id TEXT NOT NULL CHECK (length(program_id) > 0),
    detail_json TEXT NOT NULL CHECK (
      json_valid(detail_json) AND json_type(detail_json) = 'object'
    ),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  ) STRICT;

  CREATE TABLE program_definitions (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    id TEXT NOT NULL CHECK (length(id) > 0),
    definition_json TEXT NOT NULL CHECK (
      json_valid(definition_json) AND json_type(definition_json) = 'object'
    ),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  ) STRICT;

  CREATE TABLE program_catalog (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    id TEXT NOT NULL CHECK (length(id) > 0),
    entry_json TEXT NOT NULL CHECK (
      json_valid(entry_json) AND json_type(entry_json) = 'object'
    ),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, id)
  ) STRICT;

  CREATE TABLE program_preferences (
    owner_user_id TEXT PRIMARY KEY NOT NULL CHECK (length(owner_user_id) > 0),
    pinned_program_id TEXT,
    updated_at TEXT NOT NULL,
    CHECK (pinned_program_id IS NULL OR length(pinned_program_id) > 0)
  ) STRICT;

  CREATE TABLE program_reconciliations (
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    operation TEXT NOT NULL CHECK (operation IN ('create', 'manage', 'delete')),
    entity_id TEXT NOT NULL CHECK (length(entity_id) > 0),
    created_at TEXT NOT NULL,
    PRIMARY KEY (owner_user_id, operation, entity_id)
  ) STRICT;

  INSERT INTO program_summaries (
    owner_user_id, id, program_id, title, status, created_at, updated_at
  )
  SELECT owner_user_id, id, program_id, title, status, created_at, updated_at
  FROM mobile_v2_program_summaries;

  INSERT INTO program_details (
    owner_user_id, id, program_id, detail_json, updated_at
  )
  SELECT owner_user_id, id, program_id, detail_json, updated_at
  FROM mobile_v2_program_details;

  INSERT INTO program_definitions (
    owner_user_id, id, definition_json, updated_at
  )
  SELECT owner_user_id, id, definition_json, updated_at
  FROM mobile_v2_program_definitions;

  INSERT INTO program_catalog (
    owner_user_id, id, entry_json, updated_at
  )
  SELECT owner_user_id, id, entry_json, updated_at
  FROM mobile_v2_program_catalog;

  INSERT INTO program_preferences (
    owner_user_id, pinned_program_id, updated_at
  )
  SELECT owner_user_id, pinned_program_id, updated_at
  FROM mobile_v2_program_preferences;

  INSERT INTO program_reconciliations (
    owner_user_id, operation, entity_id, created_at
  )
  SELECT owner_user_id, operation, entity_id, created_at
  FROM mobile_v2_program_reconciliations;

  DROP TABLE mobile_v2_program_reconciliations;
  DROP TABLE mobile_v2_program_preferences;
  DROP TABLE mobile_v2_program_catalog;
  DROP TABLE mobile_v2_program_definitions;
  DROP TABLE mobile_v2_program_details;
  DROP TABLE mobile_v2_program_summaries;

  CREATE TABLE outbox_mutations (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    entity_type TEXT NOT NULL CHECK (
      entity_type IN ('workout_session', 'workout_set', 'program_instance', 'preference')
    ),
    entity_id TEXT NOT NULL CHECK (length(entity_id) > 0),
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL CHECK (
      json_valid(payload_json) AND json_type(payload_json) = 'object'
    ),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at TEXT NOT NULL,
    last_error_code TEXT,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (
      state IN ('pending', 'retry_wait', 'blocked_conflict')
    ),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (
      (entity_type = 'workout_session' AND operation IN ('upsert', 'complete', 'cancel'))
      OR (entity_type = 'workout_set' AND operation IN ('upsert', 'delete'))
      OR (entity_type = 'program_instance' AND operation IN ('update', 'archive', 'delete'))
      OR (entity_type = 'preference' AND operation = 'upsert')
    )
  ) STRICT;

  CREATE TABLE workout_sessions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) > 0),
    program_instance_id TEXT NOT NULL CHECK (length(program_instance_id) > 0),
    workout_index INTEGER NOT NULL CHECK (workout_index >= 0),
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    started_at TEXT NOT NULL,
    completed_at TEXT,
    notes TEXT,
    focused_slot_id TEXT,
    focused_set_id TEXT,
    updated_at TEXT NOT NULL,
    server_revision TEXT,
    CHECK (
      (status = 'in_progress' AND completed_at IS NULL)
      OR (status IN ('completed', 'cancelled') AND completed_at IS NOT NULL)
    )
  ) STRICT;

  CREATE TABLE workout_set_logs (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
    session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    slot_id TEXT NOT NULL CHECK (length(slot_id) > 0),
    position INTEGER NOT NULL CHECK (position >= 0),
    kind TEXT NOT NULL CHECK (kind IN ('working', 'warmup')),
    reps INTEGER NOT NULL CHECK (reps BETWEEN 0 AND 999),
    weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg >= 0),
    rpe INTEGER CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
    is_amrap INTEGER NOT NULL CHECK (is_amrap IN (0, 1)),
    completed_at TEXT,
    deleted_at TEXT,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE UNIQUE INDEX one_in_progress_session_per_owner
    ON workout_sessions(owner_user_id)
    WHERE status = 'in_progress';
  CREATE INDEX workout_sessions_owner_program_updated
    ON workout_sessions(owner_user_id, program_instance_id, updated_at DESC);
  CREATE INDEX workout_set_logs_session_position
    ON workout_set_logs(session_id, position, id);
  CREATE INDEX outbox_mutations_owner_schedule
    ON outbox_mutations(owner_user_id, state, next_attempt_at, created_at, id);
  CREATE INDEX legacy_user_cache_claim_state
    ON legacy_user_cache_quarantine(claim_state, quarantine_key);
  CREATE INDEX legacy_queue_claim_state
    ON legacy_queued_mutations_quarantine(claim_state, quarantine_key);
  CREATE INDEX program_summaries_owner_status
    ON program_summaries(owner_user_id, status, updated_at DESC, id);
  CREATE INDEX program_reconciliations_owner_created
    ON program_reconciliations(owner_user_id, created_at, entity_id);
`;
