-- Partial indexes for sparse columns.
--
-- 1. users.deleted_at — only rows in the soft-delete grace window need to be
--    scanned by `purge-deleted-users.ts`. A partial index keeps the structure
--    small (typically near-empty) and lets the planner skip the full table.
-- 2. refresh_tokens.previous_token_hash — first-issue refresh tokens have NULL
--    here, so a full index wastes space on rows that are never looked up by
--    previous-hash. The partial replaces the prior full index from the schema.

CREATE INDEX IF NOT EXISTS users_deleted_at_idx
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS refresh_tokens_previous_token_hash_partial_idx
  ON refresh_tokens (previous_token_hash)
  WHERE previous_token_hash IS NOT NULL;

DROP INDEX IF EXISTS refresh_tokens_previous_token_hash_idx;
