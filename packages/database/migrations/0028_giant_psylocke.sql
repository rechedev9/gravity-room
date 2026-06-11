ALTER TABLE "undo_entries" ADD COLUMN "prev_set_logs" jsonb;--> statement-breakpoint
ALTER TABLE "workout_results" ADD COLUMN "set_logs" jsonb;--> statement-breakpoint
ALTER TABLE "workout_results" ADD COLUMN "completed_at" timestamp with time zone;