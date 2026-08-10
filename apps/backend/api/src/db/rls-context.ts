/**
 * Request-scoped Postgres RLS helpers.
 *
 * Policies key off two transaction-local GUCs (see rls-setters.ts):
 *   - `app.service_role=on` — auth/cron/analytics/catalog cross-tenant work
 *   - `app.user_id=<uuid>` — end-user tenant scope
 *
 * `getDb().transaction` applies the service role by default. User mutations
 * call `setUserRlsContext` (via `lockUserForDataMutation`) so a missing
 * ownership predicate cannot touch another tenant's rows.
 */
import { getDb } from './index';
import { setServiceRlsContext, setUserRlsContext } from './rls-setters';

export type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
export { setServiceRlsContext, setUserRlsContext };

/** Run work as the cross-tenant service role (auth, cron, catalog, analytics). */
export async function withServiceRole<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => fn(tx));
}

/** Run work restricted to a single end-user tenant. */
export async function withUserRole<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await setUserRlsContext(tx, userId);
    return fn(tx);
  });
}
