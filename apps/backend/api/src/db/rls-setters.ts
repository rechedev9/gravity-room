/**
 * Transaction-local Postgres GUC setters used by RLS policies.
 * Kept free of getDb() imports so db/index can apply the default service role
 * without a circular module dependency.
 */
import { sql } from 'drizzle-orm';

export interface RlsExecutor {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
}

export async function setServiceRlsContext(tx: RlsExecutor): Promise<void> {
  await tx.execute(sql`select set_config('app.service_role', 'on', true)`);
  await tx.execute(sql`select set_config('app.user_id', '', true)`);
}

export async function setUserRlsContext(tx: RlsExecutor, userId: string): Promise<void> {
  // Parameterized set_config; reject empty / oversized / control-bearing values only.
  if (
    typeof userId !== 'string' ||
    userId.length === 0 ||
    userId.length > 64 ||
    userId.includes('\0')
  ) {
    throw new Error('Invalid user id for RLS context');
  }
  await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
  await tx.execute(sql`select set_config('app.service_role', '', true)`);
}
