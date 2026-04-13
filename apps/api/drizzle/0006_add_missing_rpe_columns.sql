ALTER TABLE "workout_results" ADD COLUMN IF NOT EXISTS "rpe" smallint;--> statement-breakpoint
ALTER TABLE "undo_entries" ADD COLUMN IF NOT EXISTS "prev_rpe" smallint;
