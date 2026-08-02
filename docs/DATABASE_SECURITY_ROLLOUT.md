# Database security and migration rollout

This runbook records deferred contract work and accepted database-layer risk. It
is intentionally explicit about what the current deployment does **not** fix.

## Migration 0044: refresh-token family expand/contract

Migration `0044_sweet_morg.sql` is an expand migration compatible with the
previously deployed application:

- `family_id` is added nullable and is **not** changed to `NOT NULL` in this
  deployment.
- A database default is installed before the existing-row repair. Old application
  code that omits `family_id` therefore continues to insert a generated value
  while migration and artifact promotion overlap.
- Existing token rows are assigned independent families before the family indexes
  are created. The TypeScript runtime keeps its stronger non-null invariant because
  every supported writer either supplies the ID or receives the database default.

Do not add `SET NOT NULL` to 0044. Contract it in a later deployment only after:

1. every old application artifact and worker has been retired;
2. at least the maximum refresh-token lifetime has elapsed;
3. monitoring confirms `SELECT count(*) FROM refresh_tokens WHERE family_id IS NULL`
   remains zero;
4. any exceptional NULL rows are repaired in bounded batches;
5. a temporary `CHECK (family_id IS NOT NULL) NOT VALID` is added and validated;
6. a short, separately scheduled contract migration sets `NOT NULL` using that
   validated invariant and then removes the temporary check.

The physical column remains nullable until that contract migration. This is a
conscious deployment-compatibility trade-off, not completed hardening.

## Migration 0045: historical exercise identity

Historical `workout_results` and `undo_entries` do not retain an immutable copy of
the exact program definition used when each row was recorded. A program template's
current JSON and version are mutable. Consequently, joining historical rows to the
current template can assign an exercise that was not used at record time.

Migration `0045_overrated_leech.sql` therefore:

- adds only nullable identity/version columns;
- performs no JSON traversal and no global historical backfill;
- leaves ambiguous historical rows NULL rather than inventing identity;
- adds pair/version checks as `NOT VALID`, avoiding a deployment-time table scan
  while still enforcing the constraints for new or changed rows.

Identity-based analytics must continue to exclude NULL legacy identities. Do not
backfill from a mutable current template, matching slot ID, or current custom
program definition.

### Follow-up procedure

1. Introduce or identify an immutable, append-only definition snapshot/version
   that proves which definition a result used. If no such provenance exists for a
   row, leave it NULL permanently.
2. Measure candidate and unresolved row counts with read-only, primary-key-ranged
   queries.
3. Backfill only provable rows in small primary-key batches, committing between
   batches and stopping on lock/statement timeout. Record batch bounds and source
   version for auditability.
4. Query each constraint predicate in bounded ranges and resolve violations.
5. Run each `ALTER TABLE ... VALIDATE CONSTRAINT` separately during a low-traffic
   window while watching replica lag, database load, and lock waits. Validation is
   intentionally outside the Vercel build migration.
6. Consider stronger non-null contracts only for a new data generation after all
   writers are proven to persist immutable identity. Legacy rows may remain NULL.

## Row-level security: accepted residual risk

PostgreSQL row-level security (RLS) is **not enabled**. Tenant isolation currently
relies on application queries consistently filtering by the authenticated user and
on API authorization tests. The pooled runtime role can read and write rows across
tenants, so one missed ownership predicate or SQL-capable application compromise
could bypass that boundary. This is an explicitly accepted residual risk for this
release; it is **not remediated** by the migration changes above.

Enabling RLS safely requires domain and operational decisions that are not available
in this review: the trusted tenant-context mechanism, whether support/admin jobs may
cross tenants, ownership semantics for orphaned custom exercises, and transaction
boundaries for pooled connections. Do not improvise permissive policies in a build
migration.

### Actionable RLS plan

1. Inventory every runtime, migration, seed, analytics, maintenance, support, and
   read-only access path. Assign owners for the cross-tenant exceptions.
2. Create separate least-privilege roles: a non-login schema owner, a migration
   role, a `NOBYPASSRLS` application role, and narrowly scoped maintenance/read-only
   roles. Production runtime credentials must not own tables or inherit migration
   privileges.
3. Choose and threat-model one tenant context. If using a setting such as
   `app.user_id`, set it with `SET LOCAL` inside a transaction for every tenant
   request, reject a missing context, and prove pooled connections cannot retain
   it. Otherwise use audited security-definer functions with fixed `search_path`.
4. Define policies first for direct user-owned tables (`program_instances`,
   `program_definitions`, `user_insights`, and owned custom exercises), then child
   tables (`workout_results` and `undo_entries`) through their parent instance.
   Design auth-token and internal-job policies separately; do not reuse end-user
   policies for authentication or analytics jobs.
5. Add direct-SQL integration tests under the real runtime role covering own-row,
   cross-tenant, missing-context, forged-context, child-row, insert/update, and
   maintenance-role cases.
6. Roll out roles and policies in a non-production environment, observe denied
   statements, then use separate reviewed migrations to `ENABLE` and ultimately
   `FORCE ROW LEVEL SECURITY`. Keep an audited rollback procedure that does not
   grant the application role table ownership or `BYPASSRLS`.

Until this plan is owner-approved and deployed, reviews and reports must describe
RLS as an open defense-in-depth gap, not a remediated finding.
