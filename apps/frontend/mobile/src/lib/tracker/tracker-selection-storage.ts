import { isRecord } from '@gzclp/domain/type-guards';

import { parseProgramInstanceId } from '../../navigation/routes';
import { bootstrapDatabase, getDatabase } from '../db/client';
import { withProgramRefreshMutationBarrier } from '../programs/program-refresh-generation';

function requireOwnerUserId(ownerUserId: string): void {
  if (ownerUserId.length === 0) {
    throw new Error('Tracker selection requires an authenticated owner');
  }
}

export async function readTrackerProgramId(ownerUserId: string): Promise<string | null> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  const row = (
    await database.getAllAsync(
      `SELECT preferences.pinned_program_id
       FROM mobile_v2_program_preferences AS preferences
       INNER JOIN mobile_v2_program_summaries AS summaries
         ON summaries.owner_user_id = preferences.owner_user_id
        AND summaries.id = preferences.pinned_program_id
        AND summaries.status = 'active'
       WHERE preferences.owner_user_id = ?`,
      ownerUserId
    )
  )[0];

  if (row === undefined) {
    return null;
  }
  if (!isRecord(row)) {
    throw new Error('SQLite returned an invalid tracker selection row');
  }
  if (row.pinned_program_id === null) {
    return null;
  }
  if (typeof row.pinned_program_id !== 'string') {
    throw new Error('SQLite returned an invalid tracker program identifier');
  }

  return parseProgramInstanceId(row.pinned_program_id);
}

export async function writeTrackerProgramId(
  ownerUserId: string,
  programInstanceId: string
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const validProgramInstanceId = parseProgramInstanceId(programInstanceId);
  if (validProgramInstanceId === null) {
    throw new Error('Cannot persist an invalid tracker program identifier');
  }
  const database = getDatabase();
  await bootstrapDatabase(database);

  await withProgramRefreshMutationBarrier(ownerUserId, 'library', () =>
    database.withExclusiveTransactionAsync(async (transaction) => {
      const matchingPrograms = await transaction.getAllAsync(
        `SELECT id
       FROM mobile_v2_program_summaries
       WHERE owner_user_id = ? AND id = ? AND status = 'active'`,
        ownerUserId,
        validProgramInstanceId
      );
      if (matchingPrograms.length !== 1) {
        throw new Error('Only an active owned program can be pinned');
      }

      await transaction.runAsync(
        `INSERT INTO mobile_v2_program_preferences (
         owner_user_id, pinned_program_id, updated_at
       ) VALUES (?, ?, ?)
       ON CONFLICT(owner_user_id) DO UPDATE SET
         pinned_program_id = excluded.pinned_program_id,
         updated_at = excluded.updated_at`,
        ownerUserId,
        validProgramInstanceId,
        new Date().toISOString()
      );
    })
  );
}
