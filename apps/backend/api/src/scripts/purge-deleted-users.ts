/**
 * Purge CLI — thin wrapper around the GDPR purge service.
 *
 * The deletion logic lives in services/purge.ts (also driven by the
 * secret-guarded `/api/internal/purge-users` cron route). This script just runs
 * it once from the command line and prints a summary. All related data
 * (program_instances, workout_results, undo_entries, refresh_tokens,
 * program_definitions) is cascaded automatically by FK constraints.
 *
 * Usage: DATABASE_URL=... tsx apps/backend/api/src/scripts/purge-deleted-users.ts
 */
import { purgeDeletedUsers } from '../services/purge';

async function main(): Promise<void> {
  const { purged, cutoff } = await purgeDeletedUsers();
  console.warn(`[purge] Purging users soft-deleted before ${cutoff}`);
  if (purged === 0) {
    console.warn('[purge] No users to purge.');
  } else {
    console.warn(`[purge] Total purged: ${purged}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[purge] Fatal error:', err);
    process.exit(1);
  });
