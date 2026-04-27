-- Compound index for efficient lookup by (instance_id, workout_index).
-- Covers the common query pattern: fetch all slot results for a specific workout.

CREATE INDEX IF NOT EXISTS workout_results_instance_workout_idx
  ON workout_results (instance_id, workout_index);
