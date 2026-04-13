/**
 * Purge script — permanently deletes users whose deleted_at is older than 30 days.
 *
 * All related data (program_instances, workout_results, undo_entries,
 * refresh_tokens, program_definitions) is cascaded automatically by FK constraints.
 *
 * Usage: DATABASE_URL=... bun run apps/api/src/scripts/purge-deleted-users.ts
 */
import { lt, and, isNotNull } from 'drizzle-orm';
import { getDb } from '../db';
import { users } from '../db/schema';

const PURGE_AFTER_DAYS = 30;
const PURGE_CUTOFF_MS = PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - PURGE_CUTOFF_MS);

  console.warn(`[purge] Purging users soft-deleted before ${cutoff.toISOString()}`);

  const deleted = await getDb()
    .delete(users)
    .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, cutoff)))
    .returning({ id: users.id, email: users.email, deletedAt: users.deletedAt });

  if (deleted.length === 0) {
    console.warn('[purge] No users to purge.');
  } else {
    for (const row of deleted) {
      console.warn(
        `[purge] Purged user ${row.id} (${row.email}), deleted at ${String(row.deletedAt)}`
      );
    }
    console.warn(`[purge] Total purged: ${deleted.length}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[purge] Fatal error:', err);
    process.exit(1);
  });
