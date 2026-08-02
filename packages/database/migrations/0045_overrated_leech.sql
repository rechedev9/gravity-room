-- Expand-only migration. Historical results do not retain an immutable copy of
-- the exact definition used when they were recorded. The current template is
-- mutable, so deriving identity from it would silently misattribute exercises.
-- Existing rows therefore remain NULL and are excluded from identity-based
-- analytics until provenance is available. See docs/DATABASE_SECURITY_ROLLOUT.md.
ALTER TABLE "undo_entries" ADD COLUMN "previous_exercise_id" varchar(100);--> statement-breakpoint
ALTER TABLE "undo_entries" ADD COLUMN "previous_definition_version" smallint;--> statement-breakpoint
ALTER TABLE "workout_results" ADD COLUMN "exercise_id" varchar(100);--> statement-breakpoint
ALTER TABLE "workout_results" ADD COLUMN "definition_version" smallint;--> statement-breakpoint

-- NOT VALID avoids scanning and validating the complete historical tables while
-- the deployment migration holds locks. PostgreSQL still enforces these checks
-- for new or changed rows. Validate them later, independently, after bounded
-- verification as described in the rollout runbook.
ALTER TABLE "workout_results"
  ADD CONSTRAINT "chk_workout_results_definition_version"
  CHECK (definition_version IS NULL OR definition_version > 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "workout_results"
  ADD CONSTRAINT "chk_workout_results_exercise_identity_pair"
  CHECK ((exercise_id IS NULL) = (definition_version IS NULL)) NOT VALID;--> statement-breakpoint
ALTER TABLE "undo_entries"
  ADD CONSTRAINT "chk_undo_entries_previous_definition_version"
  CHECK (previous_definition_version IS NULL OR previous_definition_version > 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "undo_entries"
  ADD CONSTRAINT "chk_undo_entries_exercise_identity_pair"
  CHECK ((previous_exercise_id IS NULL) = (previous_definition_version IS NULL)) NOT VALID;
