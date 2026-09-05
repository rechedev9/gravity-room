import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';

import {
  bootstrapDatabase,
  getDatabase,
  requireActiveLocalDataOwner,
  type DatabaseClient,
} from '../db/client';

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

export function prepareProgramDetail(detail: GenericProgramDetail) {
  return {
    id: detail.id,
    programId: detail.programId,
    updatedAt: detail.updatedAt,
    json: JSON.stringify(detail),
    completedDraftKeys: Object.entries(detail.results).flatMap(([workoutIndex, slots]) =>
      Object.entries(slots).flatMap(([slotId, slot]) =>
        slot.result !== undefined ? [`${workoutIndex}:${slotId}`] : []
      )
    ),
  };
}

/** The caller owns the transaction, including rollback and owner validation. */
export async function writeProgramDetail(
  transaction: DatabaseClient,
  ownerId: string,
  detail: ReturnType<typeof prepareProgramDetail>
): Promise<void> {
  await transaction.runAsync(
    `INSERT INTO program_details (owner_user_id, id, program_id, detail_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(owner_user_id, id) DO UPDATE SET
       program_id = excluded.program_id,
       detail_json = excluded.detail_json,
       updated_at = excluded.updated_at`,
    ownerId,
    detail.id,
    detail.programId,
    detail.json,
    detail.updatedAt
  );
  for (const key of detail.completedDraftKeys) {
    await transaction.runAsync(
      'DELETE FROM set_drafts WHERE owner_user_id = ? AND instance_id = ? AND slot_key = ?',
      ownerId,
      detail.id,
      key
    );
  }
}

/** Cache hydration only. Local workout edits use commitTrackerEdit. */
export async function upsertProgramDetail(detail: GenericProgramDetail): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  const prepared = prepareProgramDetail(detail);
  const database = getDatabase();
  await bootstrapDatabase(database);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Detail owner changed before write');
    await writeProgramDetail(transaction, ownerId, prepared);
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Detail owner changed during write');
  });
}

export async function getProgramDetail(
  programInstanceId: string
): Promise<GenericProgramDetail | null> {
  const ownerId = requireActiveLocalDataOwner();
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<ProgramDetailRow>(
    `SELECT id, program_id, detail_json, updated_at FROM program_details
     WHERE owner_user_id = ? AND id = ?`,
    ownerId,
    programInstanceId
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  return GenericProgramDetailSchema.parse(JSON.parse(row.detail_json));
}

export async function upsertProgramDefinition(definition: ProgramDefinition): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO program_definitions (owner_user_id, id, definition_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_user_id, id) DO UPDATE SET
         definition_json = excluded.definition_json,
         updated_at = excluded.updated_at`,
      ownerId,
      definition.id,
      JSON.stringify(definition),
      new Date().toISOString()
    );
  });
}

export async function getProgramDefinition(programId: string): Promise<ProgramDefinition | null> {
  const ownerId = requireActiveLocalDataOwner();
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<ProgramDefinitionRow>(
    `SELECT id, definition_json, updated_at FROM program_definitions
     WHERE owner_user_id = ? AND id = ?`,
    ownerId,
    programId
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  return ProgramDefinitionSchema.parse(JSON.parse(row.definition_json));
}
