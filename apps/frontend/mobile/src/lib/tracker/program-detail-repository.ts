import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';
import { isRecord } from '@gzclp/domain/type-guards';

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

function parseProgramDetailRow(value: unknown): ProgramDetailRow {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.program_id !== 'string' ||
    typeof value.detail_json !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    throw new Error('SQLite returned an invalid program detail row');
  }

  return {
    id: value.id,
    program_id: value.program_id,
    detail_json: value.detail_json,
    updated_at: value.updated_at,
  };
}

function parseProgramDefinitionRow(value: unknown): ProgramDefinitionRow {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.definition_json !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    throw new Error('SQLite returned an invalid program definition row');
  }

  return {
    id: value.id,
    definition_json: value.definition_json,
    updated_at: value.updated_at,
  };
}

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

  const rows = await database.getAllAsync(
    `SELECT id, program_id, detail_json, updated_at FROM program_details WHERE id = ?`,
    programInstanceId
  );
  const value = rows[0];
  if (value === undefined) {
    return null;
  }

  const row = parseProgramDetailRow(value);
  const detail: unknown = JSON.parse(row.detail_json);
  return GenericProgramDetailSchema.parse(detail);
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

  const rows = await database.getAllAsync(
    `SELECT id, definition_json, updated_at FROM program_definitions WHERE id = ?`,
    programId
  );
  const value = rows[0];
  if (value === undefined) {
    return null;
  }

  const row = parseProgramDefinitionRow(value);
  const definition: unknown = JSON.parse(row.definition_json);
  return ProgramDefinitionSchema.parse(definition);
}
