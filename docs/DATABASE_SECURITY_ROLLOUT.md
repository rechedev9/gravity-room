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

## Row-level security (migration 0046)

Migration `0046_security_hardening.sql` **enables and forces** RLS on tenant
tables (`users`, auth token/identity tables, `program_instances`,
`workout_results`, `undo_entries`, `program_definitions`, `user_insights`,
`exercises`). Catalog tables (`muscle_groups`, `program_templates`) stay open.

Policies honor two transaction-local GUCs set by the API
(`apps/backend/api/src/db/rls-*.ts`):

| GUC                   | Meaning                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `app.service_role=on` | Auth, cron, analytics, and other cross-tenant service work                 |
| `app.user_id=<id>`    | End-user tenant scope (set via `lockUserForDataMutation` / `withUserRole`) |

`getDb().transaction` defaults to the service role. User mutations switch to the
caller via `setUserRlsContext` so a missing ownership predicate cannot read or
write another tenant's rows while the transaction is open. Session-level
`app.service_role=on` covers non-transactional queries on the pooled connection.

### Residual operational work

1. Prefer a dedicated **non-owner** application role with `NOBYPASSRLS` so table
   ownership cannot silently bypass FORCE RLS if someone reconnects without the
   API helpers.
2. Keep migration/seed credentials separate from the runtime role.
3. Add direct-SQL integration tests under the real runtime role covering own-row,
   cross-tenant, missing-context, forged-context, child-row, and service-role cases.

### Active-email uniqueness

The same migration drops the global `users_email_unique` constraint and adds
partial unique index `users_email_active_uq` on `email WHERE deleted_at IS NULL`,
so soft-deleted addresses no longer permanently block re-registration.
