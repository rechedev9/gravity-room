-- Auto-update `updated_at` on row modification.
-- Creates a shared PL/pgSQL function and attaches BEFORE UPDATE triggers
-- to all tables that have an `updated_at` column.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at'
  ) THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
--> statement-breakpoint

-- program_instances
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_program_instances_updated_at'
  ) THEN
    CREATE TRIGGER trg_program_instances_updated_at
      BEFORE UPDATE ON program_instances
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
--> statement-breakpoint

-- program_definitions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_program_definitions_updated_at'
  ) THEN
    CREATE TRIGGER trg_program_definitions_updated_at
      BEFORE UPDATE ON program_definitions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
--> statement-breakpoint

-- program_templates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_program_templates_updated_at'
  ) THEN
    CREATE TRIGGER trg_program_templates_updated_at
      BEFORE UPDATE ON program_templates
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
