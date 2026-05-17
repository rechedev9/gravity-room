-- Add CHECK constraints for value-range validation (defense-in-depth).
-- Application-layer validation remains the primary gate; these constraints
-- guard against direct DB access or bulk imports bypassing the API.

ALTER TABLE "workout_results"
  ADD CONSTRAINT "chk_workout_results_amrap_reps"
  CHECK (amrap_reps IS NULL OR amrap_reps BETWEEN 0 AND 99);--> statement-breakpoint
ALTER TABLE "workout_results"
  ADD CONSTRAINT "chk_workout_results_rpe"
  CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10);--> statement-breakpoint
ALTER TABLE "workout_results"
  ADD CONSTRAINT "chk_workout_results_workout_index"
  CHECK (workout_index >= 0);--> statement-breakpoint
ALTER TABLE "undo_entries"
  ADD CONSTRAINT "chk_undo_entries_prev_amrap_reps"
  CHECK (prev_amrap_reps IS NULL OR prev_amrap_reps BETWEEN 0 AND 99);--> statement-breakpoint
ALTER TABLE "undo_entries"
  ADD CONSTRAINT "chk_undo_entries_prev_rpe"
  CHECK (prev_rpe IS NULL OR prev_rpe BETWEEN 1 AND 10);--> statement-breakpoint
ALTER TABLE "undo_entries"
  ADD CONSTRAINT "chk_undo_entries_workout_index"
  CHECK (workout_index >= 0);
