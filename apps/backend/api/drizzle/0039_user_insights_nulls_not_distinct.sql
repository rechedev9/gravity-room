-- Make the user_insights uniqueness treat a NULL exercise_id as equal so the
-- aggregate insights (volume_trend / frequency, exercise_id IS NULL) upsert in
-- place instead of inserting a duplicate row on every analytics compute run.
--
-- Hand-authored (the repo maintains migrations manually): de-duplicate first so
-- the NULLS NOT DISTINCT unique index is buildable on a populated database, then
-- swap the index.

-- 1. Collapse duplicates, keeping the most recently computed row per
--    (user_id, insight_type, exercise_id). `IS NOT DISTINCT FROM` groups NULL
--    exercise_id rows together; ties on computed_at break by the serial id.
DELETE FROM "user_insights" a
USING "user_insights" b
WHERE a."user_id" = b."user_id"
  AND a."insight_type" = b."insight_type"
  AND a."exercise_id" IS NOT DISTINCT FROM b."exercise_id"
  AND (
    a."computed_at" < b."computed_at"
    OR (a."computed_at" = b."computed_at" AND a."id" < b."id")
  );--> statement-breakpoint

-- 2. Drop the old NULLS DISTINCT uniqueness (covering both an index and a
--    table-constraint representation) and recreate it as NULLS NOT DISTINCT.
ALTER TABLE "user_insights" DROP CONSTRAINT IF EXISTS "user_insights_user_type_exercise_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "user_insights_user_type_exercise_uq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_insights_user_type_exercise_uq"
  ON "user_insights" ("user_id", "insight_type", "exercise_id") NULLS NOT DISTINCT;
