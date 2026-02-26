-- Migration: 0015_add_performance_indexes
--
-- NOTE: CONCURRENTLY was removed because Drizzle's migrator wraps
-- migrations in a transaction, and CREATE INDEX CONCURRENTLY cannot
-- run inside a transaction block. At our current scale (~675 exercises,
-- few program_definitions), regular CREATE INDEX completes in <100ms
-- and the brief ACCESS EXCLUSIVE lock is negligible.

-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on exercises.name for ILIKE '%term%' acceleration.
CREATE INDEX IF NOT EXISTS "exercises_name_trgm_idx"
  ON "exercises" USING gin ("name" gin_trgm_ops);

-- Composite B-tree index on the most commonly filtered columns.
CREATE INDEX IF NOT EXISTS "exercises_filter_composite_idx"
  ON "exercises" ("is_preset", "level", "equipment", "category");

-- Partial index for is_compound = true (low cardinality boolean).
CREATE INDEX IF NOT EXISTS "exercises_is_compound_true_idx"
  ON "exercises" ("is_compound") WHERE "is_compound" = true;

-- Composite index on program_definitions for the list query:
-- WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS "program_definitions_list_idx"
  ON "program_definitions" ("user_id", "deleted_at", "updated_at" DESC);
