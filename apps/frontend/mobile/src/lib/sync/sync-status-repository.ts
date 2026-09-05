import { bootstrapDatabase, getDatabase, requireActiveLocalDataOwner } from '../db/client';

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
    const code = group.last_error_code;
    const status = code?.startsWith('HTTP_') ? Number(code.slice(5)) : 0;
    if (
      code === 'INVALID_OUTBOX' ||
      (status >= 400 && status < 500 && ![408, 425, 429].includes(status))
    ) {
      needsAttention += group.count;
    }
  }
  return { total, needsAttention };
}
