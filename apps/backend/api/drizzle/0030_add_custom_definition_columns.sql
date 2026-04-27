-- Add definition_id (FK to program_definitions) and custom_definition (inline JSONB)
-- to program_instances for the fork-edit-custom-programs feature.
-- Also drops the legacy program_instances_program_id_fk constraint.

ALTER TABLE "program_instances"
  ADD COLUMN IF NOT EXISTS "definition_id" uuid;--> statement-breakpoint
ALTER TABLE "program_instances"
  ADD COLUMN IF NOT EXISTS "custom_definition" jsonb;--> statement-breakpoint
ALTER TABLE "program_instances"
  DROP CONSTRAINT IF EXISTS "program_instances_program_id_fk";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "program_instances_definition_id_idx"
  ON "program_instances" ("definition_id")
  WHERE "definition_id" IS NOT NULL;
