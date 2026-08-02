import { bootstrapDatabase, getDatabase, requireActiveLocalDataOwner } from '../db/client';

export interface ProgramSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
}

interface ProgramSummaryRow {
  readonly id: string;
  readonly title: string;
  readonly updated_at: string;
}

export async function upsertProgramSummaries(programs: readonly ProgramSummary[]): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (programs.length === 0) {
      await transaction.runAsync('DELETE FROM program_summaries WHERE owner_user_id = ?', ownerId);
      return;
    }

    const placeholders = programs.map(() => '?').join(', ');
    await transaction.runAsync(
      `DELETE FROM program_summaries
       WHERE owner_user_id = ? AND id NOT IN (${placeholders})`,
      ownerId,
      ...programs.map((program) => program.id)
    );

    for (const program of programs) {
      await transaction.runAsync(
        `INSERT INTO program_summaries (owner_user_id, id, title, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(owner_user_id, id) DO UPDATE SET
           title = excluded.title,
           updated_at = excluded.updated_at`,
        ownerId,
        program.id,
        program.title,
        program.updatedAt
      );
    }
  });
}

export async function listProgramSummaries(): Promise<ProgramSummary[]> {
  const ownerId = requireActiveLocalDataOwner();
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<ProgramSummaryRow>(
    `SELECT id, title, updated_at FROM program_summaries
     WHERE owner_user_id = ?
     ORDER BY updated_at DESC, title ASC`,
    ownerId
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}
