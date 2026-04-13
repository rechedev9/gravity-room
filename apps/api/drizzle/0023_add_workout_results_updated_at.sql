-- Add updated_at column to workout_results and attach the auto-update trigger.
-- The set_updated_at() function was created in migration 0020.

ALTER TABLE workout_results
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workout_results_updated_at'
  ) THEN
    CREATE TRIGGER trg_workout_results_updated_at
      BEFORE UPDATE ON workout_results
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
