-- Composite index for undo stack LIFO queries.
-- The undoLast() and trimUndoStack() functions query:
--   WHERE instance_id = ? ORDER BY id DESC LIMIT 1
-- Without this index, PostgreSQL uses the single-column instanceId index
-- then sorts by id DESC in memory. This composite index allows an
-- index-only scan with built-in sort order.
CREATE INDEX IF NOT EXISTS undo_entries_instance_id_desc_idx
  ON undo_entries (instance_id, id DESC);
