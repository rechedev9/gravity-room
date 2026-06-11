-- Ensure aggregate insights (exercise_id IS NULL) upsert instead of duplicating.
-- PostgreSQL's default UNIQUE semantics treat NULL values as distinct, so the
-- prior unique index did not protect rows like (user, 'volume_trend', NULL).

DELETE FROM user_insights older
USING user_insights newer
WHERE older.user_id = newer.user_id
  AND older.insight_type = newer.insight_type
  AND older.exercise_id IS NULL
  AND newer.exercise_id IS NULL
  AND (
    older.computed_at < newer.computed_at
    OR (older.computed_at = newer.computed_at AND older.id < newer.id)
  );--> statement-breakpoint

DROP INDEX IF EXISTS "user_insights_user_type_exercise_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "user_insights_user_type_exercise_uq"
  ON "user_insights" ("user_id", "insight_type", "exercise_id")
  NULLS NOT DISTINCT;
