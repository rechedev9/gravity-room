-- Align AMRAP persistence with the shared domain rep limit. The old checks
-- were introduced by hand in 0031 and are absent from prior Drizzle snapshots.
-- Replace them within the migration transaction; retain checks on new writes.
-- Do not narrow these constraints when rolling back the application artifact:
-- rows accepted by the new writer may legitimately contain 100–999 reps.
ALTER TABLE "undo_entries" DROP CONSTRAINT IF EXISTS "chk_undo_entries_previous_amrap_reps";--> statement-breakpoint
ALTER TABLE "workout_results" DROP CONSTRAINT IF EXISTS "chk_workout_results_amrap_reps";--> statement-breakpoint
ALTER TABLE "undo_entries" ADD CONSTRAINT "chk_undo_entries_previous_amrap_reps" CHECK ("undo_entries"."previous_amrap_reps" IS NULL OR "undo_entries"."previous_amrap_reps" BETWEEN 0 AND 999);--> statement-breakpoint
ALTER TABLE "workout_results" ADD CONSTRAINT "chk_workout_results_amrap_reps" CHECK ("workout_results"."amrap_reps" IS NULL OR "workout_results"."amrap_reps" BETWEEN 0 AND 999);
