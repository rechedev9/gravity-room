-- Security hardening:
-- 1) Active-only unique email so soft-deleted addresses can be re-registered
--    after the grace period / by a new signup once the prior row is deleted.
-- 2) FORCE ROW LEVEL SECURITY on tenant tables. Policies honor:
--      current_setting('app.service_role', true) = 'on'  → service/cron/auth
--      current_setting('app.user_id', true)::uuid         → end-user tenant
--    The API sets these via SET LOCAL (see apps/backend/api/src/db/rls-*.ts).
-- Catalog tables (muscle_groups, program_templates) stay unrestricted.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_active_uq"
  ON "users" ("email")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_is_service() RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('app.service_role', true), '') = 'on';
$$;--> statement-breakpoint

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS users_tenant_isolation ON "users";--> statement-breakpoint
CREATE POLICY users_tenant_isolation ON "users"
  USING (app_is_service() OR id = app_current_user_id())
  WITH CHECK (app_is_service() OR id = app_current_user_id());--> statement-breakpoint

ALTER TABLE "refresh_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refresh_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS refresh_tokens_tenant_isolation ON "refresh_tokens";--> statement-breakpoint
CREATE POLICY refresh_tokens_tenant_isolation ON "refresh_tokens"
  USING (app_is_service() OR user_id = app_current_user_id())
  WITH CHECK (app_is_service() OR user_id = app_current_user_id());--> statement-breakpoint

ALTER TABLE "user_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_identities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS user_identities_tenant_isolation ON "user_identities";--> statement-breakpoint
CREATE POLICY user_identities_tenant_isolation ON "user_identities"
  USING (app_is_service() OR user_id = app_current_user_id())
  WITH CHECK (app_is_service() OR user_id = app_current_user_id());--> statement-breakpoint

ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS password_reset_tokens_tenant_isolation ON "password_reset_tokens";--> statement-breakpoint
CREATE POLICY password_reset_tokens_tenant_isolation ON "password_reset_tokens"
  USING (app_is_service() OR user_id = app_current_user_id())
  WITH CHECK (app_is_service() OR user_id = app_current_user_id());--> statement-breakpoint

ALTER TABLE "email_verification_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS email_verification_tokens_tenant_isolation ON "email_verification_tokens";--> statement-breakpoint
CREATE POLICY email_verification_tokens_tenant_isolation ON "email_verification_tokens"
  USING (app_is_service() OR user_id = app_current_user_id())
  WITH CHECK (app_is_service() OR user_id = app_current_user_id());--> statement-breakpoint

ALTER TABLE "program_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_instances" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS program_instances_tenant_isolation ON "program_instances";--> statement-breakpoint
CREATE POLICY program_instances_tenant_isolation ON "program_instances"
  USING (app_is_service() OR user_id = app_current_user_id())
  WITH CHECK (app_is_service() OR user_id = app_current_user_id());--> statement-breakpoint

ALTER TABLE "workout_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workout_results" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS workout_results_tenant_isolation ON "workout_results";--> statement-breakpoint
CREATE POLICY workout_results_tenant_isolation ON "workout_results"
  USING (
    app_is_service()
    OR EXISTS (
      SELECT 1 FROM program_instances pi
      WHERE pi.id = instance_id AND pi.user_id = app_current_user_id()
    )
  )
  WITH CHECK (
    app_is_service()
    OR EXISTS (
      SELECT 1 FROM program_instances pi
      WHERE pi.id = instance_id AND pi.user_id = app_current_user_id()
    )
  );--> statement-breakpoint

ALTER TABLE "undo_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "undo_entries" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS undo_entries_tenant_isolation ON "undo_entries";--> statement-breakpoint
CREATE POLICY undo_entries_tenant_isolation ON "undo_entries"
  USING (
    app_is_service()
    OR EXISTS (
      SELECT 1 FROM program_instances pi
      WHERE pi.id = instance_id AND pi.user_id = app_current_user_id()
    )
  )
  WITH CHECK (
    app_is_service()
    OR EXISTS (
      SELECT 1 FROM program_instances pi
      WHERE pi.id = instance_id AND pi.user_id = app_current_user_id()
    )
  );--> statement-breakpoint

ALTER TABLE "program_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "program_definitions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS program_definitions_tenant_isolation ON "program_definitions";--> statement-breakpoint
CREATE POLICY program_definitions_tenant_isolation ON "program_definitions"
  USING (app_is_service() OR user_id = app_current_user_id())
  WITH CHECK (app_is_service() OR user_id = app_current_user_id());--> statement-breakpoint

ALTER TABLE "user_insights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_insights" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS user_insights_tenant_isolation ON "user_insights";--> statement-breakpoint
CREATE POLICY user_insights_tenant_isolation ON "user_insights"
  USING (app_is_service() OR user_id = app_current_user_id())
  WITH CHECK (app_is_service() OR user_id = app_current_user_id());--> statement-breakpoint

ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercises" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS exercises_tenant_isolation ON "exercises";--> statement-breakpoint
CREATE POLICY exercises_tenant_isolation ON "exercises"
  USING (
    app_is_service()
    OR is_system = true
    OR created_by_user_id = app_current_user_id()
  )
  WITH CHECK (
    app_is_service()
    OR (
      is_system = false
      AND created_by_user_id = app_current_user_id()
    )
  );
