-- Partial index for analytics user scan (issue 5 from security review)
-- Covers: SELECT DISTINCT user_id FROM program_instances WHERE status IN ('active', 'completed')
-- More efficient than the existing (user_id, status) btree for this all-rows DISTINCT query.
CREATE INDEX IF NOT EXISTS program_instances_active_user_idx
    ON program_instances (user_id)
    WHERE status IN ('active', 'completed');
