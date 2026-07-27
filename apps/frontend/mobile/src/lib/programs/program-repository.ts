import { isRecord } from '@gzclp/domain/type-guards';

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

function parseProgramSummaryRow(value: unknown): ProgramSummaryRow {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    throw new Error('SQLite returned an invalid program summary row');
  }

  return {
    id: value.id,
    title: value.title,
    updated_at: value.updated_at,
  };
}

export async function upsertProgramSummaries(programs: readonly ProgramSummary[]): Promise<void> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (programs.length === 0) {
      await transaction.runAsync('DELETE FROM program_summaries');
      return;
    }

    const placeholders = programs.map(() => '?').join(', ');
    await transaction.runAsync(
      `DELETE FROM program_summaries WHERE id NOT IN (${placeholders})`,
      ...programs.map((program) => program.id)
    );

    for (const program of programs) {
      await transaction.runAsync(
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

  const rows = await database.getAllAsync(
    `SELECT id, title, updated_at FROM program_summaries
     ORDER BY updated_at DESC, title ASC`
  );

  return rows.map(parseProgramSummaryRow).map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}
