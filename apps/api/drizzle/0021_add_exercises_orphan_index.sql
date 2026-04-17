-- Partial index to efficiently find orphaned custom exercises
-- (created_by was SET NULL on user deletion, but is_preset remains false).

CREATE INDEX IF NOT EXISTS exercises_orphaned_idx
  ON exercises (created_by)
  WHERE is_preset = false AND created_by IS NULL;
