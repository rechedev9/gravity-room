-- Migration 0024: Convert workout_results.id and undo_entries.id from serial (INT4) to bigserial (INT8).
-- Tables are small in production; ACCESS EXCLUSIVE lock is sub-second.

-- workout_results
ALTER TABLE workout_results ALTER COLUMN id TYPE bigint USING id::bigint;
DROP SEQUENCE IF EXISTS workout_results_id_seq;
CREATE SEQUENCE workout_results_id_seq AS bigint OWNED BY workout_results.id;
SELECT setval('workout_results_id_seq', COALESCE((SELECT MAX(id) FROM workout_results), 0));
ALTER TABLE workout_results ALTER COLUMN id SET DEFAULT nextval('workout_results_id_seq');
--> statement-breakpoint

-- undo_entries
ALTER TABLE undo_entries ALTER COLUMN id TYPE bigint USING id::bigint;
DROP SEQUENCE IF EXISTS undo_entries_id_seq;
CREATE SEQUENCE undo_entries_id_seq AS bigint OWNED BY undo_entries.id;
SELECT setval('undo_entries_id_seq', COALESCE((SELECT MAX(id) FROM undo_entries), 0));
ALTER TABLE undo_entries ALTER COLUMN id SET DEFAULT nextval('undo_entries_id_seq');
