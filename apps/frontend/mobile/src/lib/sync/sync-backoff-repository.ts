import { bootstrapDatabase, getDatabase, requireActiveLocalDataOwner } from '../db/client';

function requireLiveAttempt(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Sync attempt aborted');
    error.name = 'AbortError';
    throw error;
  }
}

interface BackoffRow {
  readonly retry_at_ms: number;
  readonly attempt_count: number;
  readonly recorded_at_ms: number;
}

export async function readSyncBackoff(ownerId: string): Promise<number> {
  const database = getDatabase();
  await bootstrapDatabase(database);
  const [row] = await database.getAllAsync<BackoffRow>(
    'SELECT retry_at_ms, attempt_count, recorded_at_ms FROM sync_backoff WHERE owner_user_id = ?',
    ownerId
  );
  if (!row) return 0;
  const now = Date.now();
  if (now < row.recorded_at_ms) {
    // Rebase once after a backwards clock correction instead of waiting years.
    const retryAt = now + Math.max(0, row.retry_at_ms - row.recorded_at_ms);
    await database.runAsync(
      `UPDATE sync_backoff SET retry_at_ms = ?, recorded_at_ms = ?
       WHERE owner_user_id = ? AND recorded_at_ms = ?`,
      retryAt,
      now,
      ownerId,
      row.recorded_at_ms
    );
    return retryAt;
  }
  return row.retry_at_ms;
}

/** The persisted owner-wide pause also applies to new edits and process restarts. */
export async function recordSyncBackoff(
  ownerId: string,
  serverRetryAt = 0,
  signal?: AbortSignal
): Promise<number> {
  const database = getDatabase();
  await bootstrapDatabase(database);
  let retryAt = 0;
  await database.withExclusiveTransactionAsync(async (tx) => {
    requireLiveAttempt(signal);
    if (requireActiveLocalDataOwner() !== ownerId) throw new Error('Sync owner changed');
    const [row] = await tx.getAllAsync<BackoffRow>(
      'SELECT retry_at_ms, attempt_count, recorded_at_ms FROM sync_backoff WHERE owner_user_id = ?',
      ownerId
    );
    const attempt = Math.min((row?.attempt_count ?? 0) + 1, 7);
    const delay = Math.min(5_000 * 2 ** (attempt - 1), 300_000);
    const now = Date.now();
    retryAt = Math.max(now + Math.round(delay * (1 + Math.random() * 0.2)), serverRetryAt);
    await tx.runAsync(
      `INSERT INTO sync_backoff (owner_user_id, retry_at_ms, recorded_at_ms, attempt_count) VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_user_id) DO UPDATE SET retry_at_ms = excluded.retry_at_ms,
         recorded_at_ms = excluded.recorded_at_ms, attempt_count = excluded.attempt_count`,
      ownerId,
      retryAt,
      now,
      attempt
    );
    requireLiveAttempt(signal);
    if (requireActiveLocalDataOwner() !== ownerId) throw new Error('Sync owner changed');
  });
  return retryAt;
}

export async function clearSyncBackoff(ownerId: string, signal?: AbortSignal): Promise<void> {
  const database = getDatabase();
  await bootstrapDatabase(database);
  await database.withExclusiveTransactionAsync(async (tx) => {
    requireLiveAttempt(signal);
    await tx.runAsync('DELETE FROM sync_backoff WHERE owner_user_id = ?', ownerId);
    requireLiveAttempt(signal);
  });
}
