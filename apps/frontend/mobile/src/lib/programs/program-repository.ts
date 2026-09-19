import { bootstrapDatabase, getDatabase, requireActiveLocalDataOwner } from '../db/client';

export interface ProgramSummary {
  readonly id: string;
  readonly programId?: string;
  readonly title: string;
  readonly updatedAt: string;
}

interface ProgramSummaryRow {
  readonly id: string;
  readonly title: string;
  readonly updated_at: string;
  readonly program_id: string | null;
}

// Keep parameter counts below even older SQLite builds' 999-variable limit.
const PRUNE_BATCH_SIZE = 200;

export async function upsertProgramSummaries(programs: readonly ProgramSummary[]): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  const snapshot = programs.map((program) => ({ ...program }));
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Summary owner changed before write');
    if (snapshot.length === 0) {
      await transaction.runAsync('DELETE FROM program_summaries WHERE owner_user_id = ?', ownerId);
      if (requireActiveLocalDataOwner() !== ownerId)
        throw new Error('Summary owner changed during write');
      return;
    }

    const retainedIds = new Set(snapshot.map((program) => program.id));
    const existing = await transaction.getAllAsync<{ id: string }>(
      'SELECT id FROM program_summaries WHERE owner_user_id = ?',
      ownerId
    );
    const removedIds = existing.filter((row) => !retainedIds.has(row.id)).map((row) => row.id);
    for (let offset = 0; offset < removedIds.length; offset += PRUNE_BATCH_SIZE) {
      const batch = removedIds.slice(offset, offset + PRUNE_BATCH_SIZE);
      await transaction.runAsync(
        `DELETE FROM program_summaries WHERE owner_user_id = ? AND id IN (${batch.map(() => '?').join(', ')})`,
        ownerId,
        ...batch
      );
    }

    for (const program of snapshot) {
      await transaction.runAsync(
        `INSERT INTO program_summaries (owner_user_id, id, title, updated_at, program_id)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(owner_user_id, id) DO UPDATE SET
           title = excluded.title,
           updated_at = excluded.updated_at,
           program_id = COALESCE(excluded.program_id, program_summaries.program_id)`,
        ownerId,
        program.id,
        program.title,
        program.updatedAt,
        program.programId ?? null
      );
    }
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Summary owner changed during write');
  });
}

export async function listProgramSummaries(): Promise<ProgramSummary[]> {
  const ownerId = requireActiveLocalDataOwner();
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<ProgramSummaryRow>(
    `SELECT id, title, updated_at, program_id FROM program_summaries
     WHERE owner_user_id = ?
     ORDER BY updated_at DESC, title ASC`,
    ownerId
  );

  if (requireActiveLocalDataOwner() !== ownerId)
    throw new Error('Summary owner changed during read');
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    ...(row.program_id ? { programId: row.program_id } : {}),
    updatedAt: row.updated_at,
  }));
}

/** Removes one cached summary for the active owner; unknown ids are a no-op. */
export async function removeProgramSummary(programInstanceId: string): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  const database = getDatabase();
  await bootstrapDatabase(database);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Summary owner changed before write');
    await transaction.runAsync(
      'DELETE FROM program_summaries WHERE owner_user_id = ? AND id = ?',
      ownerId,
      programInstanceId
    );
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Summary owner changed during write');
  });
}
