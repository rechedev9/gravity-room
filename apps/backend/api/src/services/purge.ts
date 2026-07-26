/**
 * GDPR purge service — permanently deletes users whose `deleted_at` is older
 * than the grace window.
 *
 * All related data (program_instances, workout_results, undo_entries,
 * refresh_tokens, program_definitions) is cascaded automatically by FK
 * constraints. Invoked by the secret-guarded `/api/internal/purge-users` cron
 * route; previously this lived in a standalone, unscheduled script.
 */
import { lt, and, isNotNull, asc, inArray, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { exercises, users } from '@gzclp/database/schema';
import { logger } from '../lib/logger';

export const PURGE_AFTER_DAYS = 30;
export const PURGE_BATCH_SIZE = 500;
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

  const { deleted, deletedExercises } = await getDb().transaction(async (tx) => {
    // A bounded, skip-locked batch keeps the daily serverless invocation from
    // timing out on a backlog and lets concurrent manual invocations cooperate.
    const candidates = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, cutoff)))
      .orderBy(asc(users.deletedAt), asc(users.id))
      .limit(PURGE_BATCH_SIZE)
      .for('update', { skipLocked: true });

    if (candidates.length === 0) {
      return { deleted: [], deletedExercises: [] };
    }

    const userIds = candidates.map(({ id }) => id);
    // Custom exercises use ON DELETE SET NULL. Delete them explicitly while
    // ownership is still known so account purges do not leave personal data and
    // unreachable catalog rows behind.
    const deletedExercises = await tx
      .delete(exercises)
      .where(and(inArray(exercises.createdByUserId, userIds), eq(exercises.isSystem, false)))
      .returning({ id: exercises.id });
    const deleted = await tx
      .delete(users)
      .where(inArray(users.id, userIds))
      .returning({ id: users.id });

    return { deleted, deletedExercises };
  });

  logger.info(
    {
      purged: deleted.length,
      customExercisesPurged: deletedExercises.length,
      cutoff: cutoff.toISOString(),
      batchSize: PURGE_BATCH_SIZE,
    },
    'purge: hard-deleted soft-deleted users past grace window'
  );

  return { purged: deleted.length, cutoff: cutoff.toISOString() };
}
