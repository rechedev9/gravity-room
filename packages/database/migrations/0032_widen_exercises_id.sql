-- Widen exercises.id from varchar(50) to varchar(100).
-- 9 expanded exercise IDs exceed 50 chars (e.g. 'lying_close_grip_barbell_triceps_extension_behind_the_head').
-- ALTER TYPE to a wider varchar is non-destructive and requires no data migration.
-- Idempotent: re-running against varchar(100) is a no-op.

ALTER TABLE "exercises" ALTER COLUMN "id" TYPE varchar(100);
