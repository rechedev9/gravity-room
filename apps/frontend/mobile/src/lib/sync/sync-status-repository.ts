import { bootstrapDatabase, getDatabase, requireActiveLocalDataOwner } from '../db/client';
import { syncDiagnosticNeedsAttention } from './sync-failure-policy';

export interface SyncStatus {
  readonly total: number;
  readonly needsAttention: number;
}

/** Aggregate by diagnostic rather than loading every queued payload into UI memory. */
export async function readSyncStatus(ownerId = requireActiveLocalDataOwner()): Promise<SyncStatus> {
  const database = getDatabase();
  await bootstrapDatabase(database);
  const groups = await database.getAllAsync<{ last_error_code: string | null; count: number }>(
    `SELECT last_error_code, COUNT(*) AS count FROM queued_mutations
     WHERE owner_user_id = ? GROUP BY last_error_code`,
    ownerId
  );
  let total = 0;
  let needsAttention = 0;
  for (const group of groups) {
    total += group.count;
    if (syncDiagnosticNeedsAttention(group.last_error_code)) {
      needsAttention += group.count;
    }
  }
  return { total, needsAttention };
}
