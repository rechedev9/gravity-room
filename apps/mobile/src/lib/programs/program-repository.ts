import { bootstrapDatabase, getDatabase } from '../db/client';

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
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withTransactionAsync(async () => {
    if (programs.length === 0) {
      await database.runAsync('DELETE FROM program_summaries');
      return;
    }

    const placeholders = programs.map(() => '?').join(', ');
    await database.runAsync(
      `DELETE FROM program_summaries WHERE id NOT IN (${placeholders})`,
      ...programs.map((program) => program.id)
    );

    for (const program of programs) {
      await database.runAsync(
        `INSERT INTO program_summaries (id, title, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           updated_at = excluded.updated_at`,
        program.id,
        program.title,
        program.updatedAt
      );
    }
  });
}

export async function listProgramSummaries(): Promise<ProgramSummary[]> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<ProgramSummaryRow>(
    `SELECT id, title, updated_at FROM program_summaries
     ORDER BY updated_at DESC, title ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}
