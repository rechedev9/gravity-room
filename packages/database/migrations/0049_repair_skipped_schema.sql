ALTER TABLE "workout_results" ADD COLUMN IF NOT EXISTS "rpe" smallint;--> statement-breakpoint
ALTER TABLE "undo_entries" ADD COLUMN IF NOT EXISTS "prev_rpe" smallint;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'program_definition_status') THEN
    CREATE TYPE "public"."program_definition_status"
      AS ENUM('draft', 'pending_review', 'approved', 'rejected');
  END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "program_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "definition" jsonb NOT NULL,
  "status" "program_definition_status" DEFAULT 'draft' NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'program_definitions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "program_definitions" ADD CONSTRAINT "program_definitions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "program_definitions_user_id_idx"
  ON "program_definitions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "program_definitions_status_idx"
  ON "program_definitions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "workout_results" ALTER COLUMN "slot_id" TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "undo_entries" ALTER COLUMN "slot_id" TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE IF EXISTS "exercises" ALTER COLUMN "id" TYPE varchar(100);
