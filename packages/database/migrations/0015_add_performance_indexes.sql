-- Migration: 0015_add_performance_indexes
--
-- NOTE: CONCURRENTLY removed (incompatible with Drizzle's transaction wrapper).
-- Statement breakpoint markers required for postgres-js compatibility.

CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exercises_name_trgm_idx"
  ON "exercises" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exercises_filter_composite_idx"
  ON "exercises" ("is_preset", "level", "equipment", "category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exercises_is_compound_true_idx"
  ON "exercises" ("is_compound") WHERE "is_compound" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "program_definitions_list_idx"
  ON "program_definitions" ("user_id", "deleted_at", "updated_at" DESC);
