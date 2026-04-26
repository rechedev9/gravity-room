import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';

import { bootstrapDatabase, getDatabase } from '../db/client';

type ProgramDetailRow = {
  readonly id: string;
  readonly program_id: string;
  readonly detail_json: string;
  readonly updated_at: string;
};

type ProgramDefinitionRow = {
  readonly id: string;
  readonly definition_json: string;
  readonly updated_at: string;
};

export async function upsertProgramDetail(detail: GenericProgramDetail): Promise<void> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO program_details (id, program_id, detail_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         program_id = excluded.program_id,
         detail_json = excluded.detail_json,
         updated_at = excluded.updated_at`,
      detail.id,
      detail.programId,
      JSON.stringify(detail),
      detail.updatedAt
    );
  });
}

export async function getProgramDetail(
  programInstanceId: string
): Promise<GenericProgramDetail | null> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<ProgramDetailRow>(
    `SELECT id, program_id, detail_json, updated_at FROM program_details WHERE id = ?`,
    programInstanceId
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  return GenericProgramDetailSchema.parse(JSON.parse(row.detail_json));
}

export async function upsertProgramDefinition(definition: ProgramDefinition): Promise<void> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO program_definitions (id, definition_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         definition_json = excluded.definition_json,
         updated_at = excluded.updated_at`,
      definition.id,
      JSON.stringify(definition),
      new Date().toISOString()
    );
  });
}

export async function getProgramDefinition(programId: string): Promise<ProgramDefinition | null> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<ProgramDefinitionRow>(
    `SELECT id, definition_json, updated_at FROM program_definitions WHERE id = ?`,
    programId
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  return ProgramDefinitionSchema.parse(JSON.parse(row.definition_json));
}
