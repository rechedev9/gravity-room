ALTER TABLE undo_entries RENAME COLUMN prev_result TO previous_result;
ALTER TABLE undo_entries RENAME COLUMN prev_amrap_reps TO previous_amrap_reps;
ALTER TABLE undo_entries RENAME COLUMN prev_rpe TO previous_rpe;
ALTER TABLE undo_entries RENAME COLUMN prev_set_logs TO previous_set_logs;
ALTER TABLE undo_entries RENAME CONSTRAINT chk_undo_entries_prev_amrap_reps TO chk_undo_entries_previous_amrap_reps;
ALTER TABLE undo_entries RENAME CONSTRAINT chk_undo_entries_prev_rpe TO chk_undo_entries_previous_rpe;
