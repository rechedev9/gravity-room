-- Auto-complete duplicate active programs (keep the newest per user)
UPDATE program_instances
SET status = 'completed', updated_at = NOW()
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
    FROM program_instances
    WHERE status = 'active'
  ) sub
  WHERE rn > 1
);
--> statement-breakpoint
-- Enforce: at most one active program per user
CREATE UNIQUE INDEX program_instances_one_active_per_user ON program_instances (user_id) WHERE status = 'active';
