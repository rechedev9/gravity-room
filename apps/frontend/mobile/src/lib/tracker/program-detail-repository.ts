import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';
import { isRecord } from '@gzclp/domain/type-guards';

import { bootstrapDatabase, getDatabase } from '../db/client';
import {
  abandonProgramRefreshLease,
  assertProgramRefreshLeaseCanCommit,
  getNewerProgramRefreshLeaseSettlement,
  markProgramRefreshLeaseCommitted,
  ObsoleteProgramRefreshLeaseError,
  withProgramRefreshCommitBarrier,
  withProgramRefreshMutationBarrier,
  type ProgramRefreshLease,
} from '../programs/program-refresh-generation';
import type { DatabaseClient } from '../db/expo-sqlite-adapter';

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

async function commitRefreshTransaction(
  database: DatabaseClient,
  lease: ProgramRefreshLease,
  write: (transaction: DatabaseClient) => Promise<void>
): Promise<boolean> {
  try {
    while (true) {
      const commit = () =>
        withProgramRefreshCommitBarrier(lease.ownerUserId, lease.resource, async () => {
          const newerSettlement = getNewerProgramRefreshLeaseSettlement(lease);
          if (newerSettlement !== null) {
            return { status: 'wait' as const, newerSettlement };
          }
          assertProgramRefreshLeaseCanCommit(lease);
          await database.withExclusiveTransactionAsync(async (transaction) => {
            assertProgramRefreshLeaseCanCommit(lease);
            await write(transaction);
            assertProgramRefreshLeaseCanCommit(lease);
          });
          markProgramRefreshLeaseCommitted(lease);
          return { status: 'committed' as const };
        });
      const outcome = lease.resource.startsWith('detail:')
        ? await withProgramRefreshCommitBarrier(lease.ownerUserId, 'library', commit)
        : await commit();
      if (outcome.status === 'committed') {
        return true;
      }
      await outcome.newerSettlement;
    }
  } catch (error) {
    await abandonProgramRefreshLease(lease);
    if (error instanceof ObsoleteProgramRefreshLeaseError) {
      return false;
    }
    throw error;
  }
}

function requireOwnerUserId(ownerUserId: string): void {
  if (ownerUserId.length === 0) {
    throw new Error('Program detail cache requires an authenticated owner');
  }
}

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

export async function upsertProgramDetail(
  ownerUserId: string,
  detail: GenericProgramDetail
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  await withProgramRefreshMutationBarrier(ownerUserId, `detail:${detail.id}`, async () => {
    const database = getDatabase();
    await bootstrapDatabase(database);
    await database.withExclusiveTransactionAsync(async (transaction) => {
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
    });
  });
}

export async function commitProgramDetailRefresh(
  lease: ProgramRefreshLease,
  detail: GenericProgramDetail
): Promise<boolean> {
  requireOwnerUserId(lease.ownerUserId);
  if (lease.resource !== `detail:${detail.id}`) {
    await abandonProgramRefreshLease(lease);
    return false;
  }
  const database = getDatabase();
  await bootstrapDatabase(database);
  return commitRefreshTransaction(database, lease, async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO mobile_v2_program_details (
         owner_user_id, id, program_id, detail_json, updated_at
       )
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_user_id, id) DO UPDATE SET
         program_id = excluded.program_id,
         detail_json = excluded.detail_json,
         updated_at = excluded.updated_at`,
      lease.ownerUserId,
      detail.id,
      detail.programId,
      JSON.stringify(detail),
      detail.updatedAt
    );
  });
}

export async function getProgramDetail(
  ownerUserId: string,
  programInstanceId: string
): Promise<GenericProgramDetail | null> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync(
    `SELECT id, program_id, detail_json, updated_at
     FROM mobile_v2_program_details
     WHERE owner_user_id = ? AND id = ?`,
    ownerUserId,
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

export async function upsertProgramDefinition(
  ownerUserId: string,
  definition: ProgramDefinition
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.withExclusiveTransactionAsync(async (transaction) => {
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
  });
}

export async function commitProgramDefinitionRefresh(
  lease: ProgramRefreshLease,
  definition: ProgramDefinition
): Promise<boolean> {
  requireOwnerUserId(lease.ownerUserId);
  if (lease.resource !== `definition:${definition.id}`) {
    await abandonProgramRefreshLease(lease);
    return false;
  }
  const database = getDatabase();
  await bootstrapDatabase(database);
  return commitRefreshTransaction(database, lease, async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO mobile_v2_program_definitions (
         owner_user_id, id, definition_json, updated_at
       )
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_user_id, id) DO UPDATE SET
         definition_json = excluded.definition_json,
         updated_at = excluded.updated_at`,
      lease.ownerUserId,
      definition.id,
      JSON.stringify(definition),
      new Date().toISOString()
    );
  });
}

export async function getProgramDefinition(
  ownerUserId: string,
  programId: string
): Promise<ProgramDefinition | null> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync(
    `SELECT id, definition_json, updated_at
     FROM mobile_v2_program_definitions
     WHERE owner_user_id = ? AND id = ?`,
    ownerUserId,
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
