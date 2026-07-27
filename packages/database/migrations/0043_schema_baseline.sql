-- Catch the Drizzle snapshot up to the manually maintained 0029-0042
-- migrations. This migration also repairs lifecycle invariants those
-- migrations left unenforced.

-- Old account purges used ON DELETE SET NULL for custom exercises, leaving
-- unreachable personal rows behind. Remove the historical orphan backlog.
DELETE FROM "exercises"
WHERE "is_system" = false
  AND "created_by_user_id" IS NULL;--> statement-breakpoint

-- definition_id was documented and modeled as a relation but migration 0030
-- only added the column/index. Clear legacy invalid references, then enforce
-- the nullable relationship while preserving instance snapshots on definition
-- deletion.
UPDATE "program_instances" instance
SET "definition_id" = NULL
WHERE "definition_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "program_definitions" definition
    WHERE definition."id" = instance."definition_id"
  );--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'program_instances_definition_id_program_definitions_id_fk'
      AND conrelid = 'program_instances'::regclass
  ) THEN
    ALTER TABLE "program_instances"
      ADD CONSTRAINT "program_instances_definition_id_program_definitions_id_fk"
      FOREIGN KEY ("definition_id")
      REFERENCES "program_definitions"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
