-- Add amrap: true to all GZCLP T1 stage objects (d1-t1, d2-t1, d3-t1, d4-t1).
-- Each T1 slot has 3 stages (5×3, 6×2, 10×1) that should all be AMRAP.
-- Idempotent: re-running on data that already has amrap is a no-op.

UPDATE program_templates
SET definition = (
  SELECT result FROM (
    SELECT
      -- Day 1 T1 (slot index 0)
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(
                              definition,
                              '{days,0,slots,0,stages,0,amrap}', 'true'::jsonb
                            ),
                            '{days,0,slots,0,stages,1,amrap}', 'true'::jsonb
                          ),
                          '{days,0,slots,0,stages,2,amrap}', 'true'::jsonb
                        ),
                        -- Day 2 T1 (slot index 0)
                        '{days,1,slots,0,stages,0,amrap}', 'true'::jsonb
                      ),
                      '{days,1,slots,0,stages,1,amrap}', 'true'::jsonb
                    ),
                    '{days,1,slots,0,stages,2,amrap}', 'true'::jsonb
                  ),
                  -- Day 3 T1 (slot index 0)
                  '{days,2,slots,0,stages,0,amrap}', 'true'::jsonb
                ),
                '{days,2,slots,0,stages,1,amrap}', 'true'::jsonb
              ),
              '{days,2,slots,0,stages,2,amrap}', 'true'::jsonb
            ),
            -- Day 4 T1 (slot index 0)
            '{days,3,slots,0,stages,0,amrap}', 'true'::jsonb
          ),
          '{days,3,slots,0,stages,1,amrap}', 'true'::jsonb
        ),
        '{days,3,slots,0,stages,2,amrap}', 'true'::jsonb
      ) AS result
  ) AS subq
)
WHERE id = 'gzclp';
