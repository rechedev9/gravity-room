import {
  CatalogEntrySchema,
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  ProgramInstanceSchema,
  type CatalogEntry,
  type GenericProgramDetail,
  type ProgramDefinition,
  type ProgramInstance,
} from '@gzclp/domain';
import { isRecord } from '@gzclp/domain/type-guards';

import { bootstrapDatabase, getDatabase } from '../db/client';
import type { DatabaseClient } from '../db/expo-sqlite-adapter';

export type ProgramStatus = ProgramInstance['status'];

export interface ProgramSummary {
  readonly id: string;
  readonly programId: string;
  readonly title: string;
  readonly status: ProgramStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ProgramSummaryRow {
  readonly id: string;
  readonly program_id: string;
  readonly title: string;
  readonly status: ProgramStatus;
  readonly created_at: string;
  readonly updated_at: string;
}

interface CatalogRow {
  readonly entry_json: string;
}

export type ProgramReconciliationOperation = 'create' | 'manage' | 'delete';

export interface PendingCreateReconciliation {
  readonly pending: true;
  readonly programInstanceId: string | null;
}

function requireOwnerUserId(ownerUserId: string): void {
  if (ownerUserId.length === 0) {
    throw new Error('Program cache requires an authenticated owner');
  }
}

function parseProgramStatus(value: unknown): ProgramStatus | null {
  const result = ProgramInstanceSchema.shape.status.safeParse(value);
  return result.success ? result.data : null;
}

function parseProgramSummaryRow(value: unknown): ProgramSummaryRow {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.program_id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.created_at !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    throw new Error('SQLite returned an invalid program summary row');
  }

  const status = parseProgramStatus(value.status);
  if (status === null) {
    throw new Error('SQLite returned an invalid program summary status');
  }

  return {
    id: value.id,
    program_id: value.program_id,
    title: value.title,
    status,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

function parseCatalogRow(value: unknown): CatalogRow {
  if (!isRecord(value) || typeof value.entry_json !== 'string') {
    throw new Error('SQLite returned an invalid program catalog row');
  }

  return { entry_json: value.entry_json };
}

function parseCatalogEntryJson(source: string): CatalogEntry {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('SQLite returned malformed program catalog JSON');
  }

  const entry = CatalogEntrySchema.parse(value);
  if (
    entry.id.length === 0 ||
    entry.name.length === 0 ||
    entry.source !== 'preset' ||
    entry.totalWorkouts <= 0 ||
    entry.workoutsPerWeek <= 0 ||
    entry.cycleLength <= 0
  ) {
    throw new Error('SQLite returned an invalid cached catalog entry');
  }

  return entry;
}

function toSummary(detailValue: GenericProgramDetail): ProgramSummary {
  const detail = GenericProgramDetailSchema.parse(detailValue);
  const status = parseProgramStatus(detail.status);
  if (status === null) {
    throw new Error('Program detail has an invalid lifecycle status');
  }

  return {
    id: detail.id,
    programId: detail.programId,
    title: detail.name,
    status,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

async function upsertSummary(
  transaction: DatabaseClient,
  ownerUserId: string,
  program: ProgramSummary
): Promise<void> {
  await transaction.runAsync(
    `INSERT INTO mobile_v2_program_summaries (
       owner_user_id, id, program_id, title, status, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_user_id, id) DO UPDATE SET
       program_id = excluded.program_id,
       title = excluded.title,
       status = excluded.status,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
    ownerUserId,
    program.id,
    program.programId,
    program.title,
    program.status,
    program.createdAt,
    program.updatedAt
  );
}

async function replaceSummaries(
  transaction: DatabaseClient,
  ownerUserId: string,
  programs: readonly ProgramSummary[]
): Promise<void> {
  if (programs.length === 0) {
    await transaction.runAsync(
      'DELETE FROM mobile_v2_program_summaries WHERE owner_user_id = ?',
      ownerUserId
    );
  } else {
    const placeholders = programs.map(() => '?').join(', ');
    await transaction.runAsync(
      `DELETE FROM mobile_v2_program_summaries
       WHERE owner_user_id = ? AND id NOT IN (${placeholders})`,
      ownerUserId,
      ...programs.map((program) => program.id)
    );

    for (const program of programs) {
      await upsertSummary(transaction, ownerUserId, program);
    }
  }

  await transaction.runAsync(
    `DELETE FROM mobile_v2_program_details
     WHERE owner_user_id = ?
       AND NOT EXISTS (
         SELECT 1
         FROM mobile_v2_program_summaries
         WHERE owner_user_id = ? AND id = mobile_v2_program_details.id
       )`,
    ownerUserId,
    ownerUserId
  );

  await transaction.runAsync(
    `UPDATE mobile_v2_program_preferences
     SET pinned_program_id = NULL, updated_at = ?
     WHERE owner_user_id = ?
       AND pinned_program_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM mobile_v2_program_summaries
         WHERE owner_user_id = ? AND id = pinned_program_id AND status = 'active'
       )`,
    new Date().toISOString(),
    ownerUserId,
    ownerUserId
  );

  const pendingDeletes = await transaction.getAllAsync(
    `SELECT entity_id
     FROM mobile_v2_program_reconciliations
     WHERE owner_user_id = ? AND operation = 'delete'`,
    ownerUserId
  );
  for (const value of pendingDeletes) {
    if (!isRecord(value) || typeof value.entity_id !== 'string') {
      throw new Error('SQLite returned an invalid program reconciliation row');
    }
    if (!programs.some((program) => program.id === value.entity_id)) {
      await deleteLocalProgramDataInTransaction(transaction, ownerUserId, value.entity_id);
      await transaction.runAsync(
        `DELETE FROM mobile_v2_program_reconciliations
         WHERE owner_user_id = ? AND operation = 'delete' AND entity_id = ?`,
        ownerUserId,
        value.entity_id
      );
    }
  }

  await transaction.runAsync(
    `DELETE FROM mobile_v2_program_reconciliations
     WHERE owner_user_id = ?
       AND (
         (
           operation = 'create'
           AND entity_id NOT LIKE 'unknown:%'
           AND EXISTS (
             SELECT 1
             FROM mobile_v2_program_summaries
             WHERE owner_user_id = ? AND id = mobile_v2_program_reconciliations.entity_id
           )
         )
         OR (
           operation = 'manage'
           AND EXISTS (
             SELECT 1
             FROM mobile_v2_program_summaries
             WHERE owner_user_id = ? AND id = mobile_v2_program_reconciliations.entity_id
           )
         )
       )`,
    ownerUserId,
    ownerUserId,
    ownerUserId
  );
}

async function upsertDetail(
  transaction: DatabaseClient,
  ownerUserId: string,
  detail: GenericProgramDetail
): Promise<void> {
  await transaction.runAsync(
    `INSERT INTO mobile_v2_program_details (
       owner_user_id, id, program_id, detail_json, updated_at
     )
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(owner_user_id, id) DO UPDATE SET
       program_id = excluded.program_id,
       detail_json = excluded.detail_json,
       updated_at = excluded.updated_at`,
    ownerUserId,
    detail.id,
    detail.programId,
    JSON.stringify(detail),
    detail.updatedAt
  );
}

async function upsertDefinition(
  transaction: DatabaseClient,
  ownerUserId: string,
  definition: ProgramDefinition
): Promise<void> {
  await transaction.runAsync(
    `INSERT INTO mobile_v2_program_definitions (
       owner_user_id, id, definition_json, updated_at
     )
     VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_user_id, id) DO UPDATE SET
       definition_json = excluded.definition_json,
       updated_at = excluded.updated_at`,
    ownerUserId,
    definition.id,
    JSON.stringify(definition),
    new Date().toISOString()
  );
}

export async function replaceProgramSummaries(
  ownerUserId: string,
  programs: readonly ProgramSummary[]
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync((transaction) =>
    replaceSummaries(transaction, ownerUserId, programs)
  );
}

export async function listProgramSummaries(ownerUserId: string): Promise<ProgramSummary[]> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync(
    `SELECT id, program_id, title, status, created_at, updated_at
     FROM mobile_v2_program_summaries
     WHERE owner_user_id = ?
     ORDER BY updated_at DESC, title ASC`,
    ownerUserId
  );

  return rows.map(parseProgramSummaryRow).map((row) => ({
    id: row.id,
    programId: row.program_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function replaceCachedCatalog(
  ownerUserId: string,
  entries: readonly CatalogEntry[]
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'DELETE FROM mobile_v2_program_catalog WHERE owner_user_id = ?',
      ownerUserId
    );

    for (const entry of entries) {
      await transaction.runAsync(
        `INSERT INTO mobile_v2_program_catalog (
           owner_user_id, id, entry_json, updated_at
         ) VALUES (?, ?, ?, ?)`,
        ownerUserId,
        entry.id,
        JSON.stringify(entry),
        new Date().toISOString()
      );
    }
  });
}

export async function listCachedCatalog(ownerUserId: string): Promise<CatalogEntry[]> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync(
    `SELECT entry_json
     FROM mobile_v2_program_catalog
     WHERE owner_user_id = ?
     ORDER BY id`,
    ownerUserId
  );

  return rows.map(parseCatalogRow).map((row) => parseCatalogEntryJson(row.entry_json));
}

export async function cacheCreatedProgram(input: {
  readonly ownerUserId: string;
  readonly detail: GenericProgramDetail;
  readonly definition: ProgramDefinition;
  readonly serverPrograms: readonly ProgramSummary[] | null;
}): Promise<void> {
  requireOwnerUserId(input.ownerUserId);
  const detail = GenericProgramDetailSchema.parse(input.detail);
  const definition = ProgramDefinitionSchema.parse(input.definition);
  const createdSummary = toSummary(detail);
  if (
    definition.source !== 'preset' ||
    detail.programId !== definition.id ||
    createdSummary.status !== 'active' ||
    (input.serverPrograms !== null &&
      !input.serverPrograms.some(
        (program) => program.id === createdSummary.id && program.status === createdSummary.status
      ))
  ) {
    throw new Error('Created program bundle does not match server truth');
  }
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (input.serverPrograms === null) {
      await transaction.runAsync(
        `UPDATE mobile_v2_program_details
         SET detail_json = json_set(
               detail_json,
               '$.status', 'completed',
               '$.updatedAt', ?
             ),
             updated_at = ?
         WHERE owner_user_id = ?
           AND id <> ?
           AND id IN (
             SELECT id
             FROM mobile_v2_program_summaries
             WHERE owner_user_id = ? AND status = 'active'
           )`,
        detail.updatedAt,
        detail.updatedAt,
        input.ownerUserId,
        createdSummary.id,
        input.ownerUserId
      );
      await transaction.runAsync(
        `UPDATE mobile_v2_program_summaries
         SET status = 'completed', updated_at = ?
         WHERE owner_user_id = ? AND status = 'active' AND id <> ?`,
        detail.updatedAt,
        input.ownerUserId,
        createdSummary.id
      );
      await upsertSummary(transaction, input.ownerUserId, createdSummary);
    } else {
      await replaceSummaries(transaction, input.ownerUserId, input.serverPrograms);
    }
    await upsertDetail(transaction, input.ownerUserId, detail);
    await upsertDefinition(transaction, input.ownerUserId, definition);
    await transaction.runAsync(
      `INSERT INTO mobile_v2_program_preferences (
         owner_user_id, pinned_program_id, updated_at
       ) VALUES (?, ?, ?)
       ON CONFLICT(owner_user_id) DO UPDATE SET
         pinned_program_id = excluded.pinned_program_id,
         updated_at = excluded.updated_at`,
      input.ownerUserId,
      detail.id,
      new Date().toISOString()
    );
  });
}

export async function cacheManagedProgram(
  ownerUserId: string,
  detailValue: GenericProgramDetail
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const detail = GenericProgramDetailSchema.parse(detailValue);
  const summary = toSummary(detail);
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (summary.status === 'active') {
      await transaction.runAsync(
        `UPDATE mobile_v2_program_details
         SET detail_json = json_set(
               detail_json,
               '$.status', 'completed',
               '$.updatedAt', ?
             ),
             updated_at = ?
         WHERE owner_user_id = ?
           AND id <> ?
           AND id IN (
             SELECT id
             FROM mobile_v2_program_summaries
             WHERE owner_user_id = ? AND status = 'active'
           )`,
        detail.updatedAt,
        detail.updatedAt,
        ownerUserId,
        detail.id,
        ownerUserId
      );
      await transaction.runAsync(
        `UPDATE mobile_v2_program_summaries
         SET status = 'completed', updated_at = ?
         WHERE owner_user_id = ? AND status = 'active' AND id <> ?`,
        detail.updatedAt,
        ownerUserId,
        detail.id
      );
    }
    await upsertSummary(transaction, ownerUserId, summary);
    await transaction.runAsync(
      `INSERT OR IGNORE INTO mobile_v2_program_details (
         owner_user_id, id, program_id, detail_json, updated_at
       ) VALUES (?, ?, ?, ?, ?)`,
      ownerUserId,
      detail.id,
      detail.programId,
      JSON.stringify(detail),
      detail.updatedAt
    );
    await transaction.runAsync(
      `UPDATE mobile_v2_program_details
       SET program_id = ?,
           detail_json = json_set(
             detail_json,
             '$.name', ?,
             '$.status', ?,
             '$.updatedAt', ?
           ),
           updated_at = ?
       WHERE owner_user_id = ? AND id = ?`,
      detail.programId,
      detail.name,
      detail.status,
      detail.updatedAt,
      detail.updatedAt,
      ownerUserId,
      detail.id
    );
    if (summary.status !== 'active') {
      await transaction.runAsync(
        `UPDATE mobile_v2_program_preferences
         SET pinned_program_id = NULL, updated_at = ?
         WHERE owner_user_id = ? AND pinned_program_id = ?`,
        new Date().toISOString(),
        ownerUserId,
        detail.id
      );
    }
  });
}

async function deleteLocalProgramDataInTransaction(
  transaction: DatabaseClient,
  ownerUserId: string,
  programInstanceId: string
): Promise<void> {
  await transaction.runAsync(
    `UPDATE mobile_v2_program_preferences
     SET pinned_program_id = NULL, updated_at = ?
     WHERE owner_user_id = ? AND pinned_program_id = ?`,
    new Date().toISOString(),
    ownerUserId,
    programInstanceId
  );
  await transaction.runAsync(
    `DELETE FROM mobile_v2_program_details
     WHERE owner_user_id = ? AND id = ?`,
    ownerUserId,
    programInstanceId
  );
  await transaction.runAsync(
    `DELETE FROM mobile_v2_program_summaries
     WHERE owner_user_id = ? AND id = ?`,
    ownerUserId,
    programInstanceId
  );
  await transaction.runAsync('DELETE FROM queued_mutations WHERE entity_id = ?', programInstanceId);
}

export async function deleteLocalProgramData(
  ownerUserId: string,
  programInstanceId: string
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await deleteLocalProgramDataInTransaction(transaction, ownerUserId, programInstanceId);
  });
}

export async function recordProgramReconciliation(
  ownerUserId: string,
  operation: ProgramReconciliationOperation,
  entityId: string
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  if (entityId.length === 0) {
    throw new Error('Program reconciliation requires an entity identifier');
  }
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.runAsync(
    `INSERT INTO mobile_v2_program_reconciliations (
       owner_user_id, operation, entity_id, created_at
     ) VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_user_id, operation, entity_id) DO UPDATE SET
       created_at = excluded.created_at`,
    ownerUserId,
    operation,
    entityId,
    new Date().toISOString()
  );
}

export async function readPendingCreateReconciliation(
  ownerUserId: string
): Promise<PendingCreateReconciliation | null> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync(
    `SELECT entity_id
     FROM mobile_v2_program_reconciliations
     WHERE owner_user_id = ? AND operation = 'create'
     ORDER BY created_at DESC, entity_id
     LIMIT 1`,
    ownerUserId
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  if (!isRecord(row) || typeof row.entity_id !== 'string') {
    throw new Error('SQLite returned an invalid pending create reconciliation');
  }
  return {
    pending: true,
    programInstanceId: row.entity_id.startsWith('unknown:') ? null : row.entity_id,
  };
}
