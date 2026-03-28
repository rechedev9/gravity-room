-- +goose Up
-- Auto-update `updated_at` on row modification.
-- Creates a shared PL/pgSQL function and attaches BEFORE UPDATE triggers
-- to all tables that have an `updated_at` column.

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- users
-- +goose StatementBegin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at'
  ) THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
-- +goose StatementEnd

-- program_instances
-- +goose StatementBegin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_program_instances_updated_at'
  ) THEN
    CREATE TRIGGER trg_program_instances_updated_at
      BEFORE UPDATE ON program_instances
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
-- +goose StatementEnd

-- program_definitions
-- +goose StatementBegin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_program_definitions_updated_at'
  ) THEN
    CREATE TRIGGER trg_program_definitions_updated_at
      BEFORE UPDATE ON program_definitions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
-- +goose StatementEnd

-- program_templates
-- +goose StatementBegin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_program_templates_updated_at'
  ) THEN
    CREATE TRIGGER trg_program_templates_updated_at
      BEFORE UPDATE ON program_templates
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
-- +goose StatementEnd
