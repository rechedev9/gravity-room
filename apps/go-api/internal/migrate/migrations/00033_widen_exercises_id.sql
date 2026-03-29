-- +goose Up
-- Widen exercises.id from varchar(50) to varchar(100).
-- 9 expanded exercise IDs exceed 50 chars (e.g. 'lying_close_grip_barbell_triceps_extension_behind_the_head').
-- ALTER TYPE to a wider varchar is non-destructive and requires no data migration.
-- This was a hotfix in the TS bootstrap (bootstrap.ts line 119) that was never
-- captured as a Drizzle migration.
ALTER TABLE IF EXISTS "exercises" ALTER COLUMN "id" TYPE varchar(100);
