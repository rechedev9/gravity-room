/**
 * GDPR purge service — permanently deletes users whose `deleted_at` is older
 * than the grace window.
 *
 * All related data (program_instances, workout_results, undo_entries,
 * refresh_tokens, program_definitions) is cascaded automatically by FK
 * constraints. Invoked by the secret-guarded `/api/internal/purge-users` cron
 * route; previously this lived in a standalone, unscheduled script.
 */
import { lt, and, isNotNull } from 'drizzle-orm';
import { getDb } from '../db';
import { users } from '@gzclp/database/schema';
import { logger } from '../lib/logger';

export const PURGE_AFTER_DAYS = 30;
const PURGE_CUTOFF_MS = PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000;

export interface PurgeSummary {
  /** Number of users hard-deleted on this run. */
  readonly purged: number;
  /** ISO timestamp; users soft-deleted before this were purged. */
  readonly cutoff: string;
}

/** Hard-delete users soft-deleted before the cutoff. Returns a summary. */
export async function purgeDeletedUsers(): Promise<PurgeSummary> {
  const cutoff = new Date(Date.now() - PURGE_CUTOFF_MS);

  const deleted = await getDb()
    .delete(users)
    .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, cutoff)))
    .returning({ id: users.id });

  logger.info(
    { purged: deleted.length, cutoff: cutoff.toISOString() },
    'purge: hard-deleted soft-deleted users past grace window'
  );

  return { purged: deleted.length, cutoff: cutoff.toISOString() };
}
