import {
  CatalogEntrySchema,
  GenericProgramDetailSchema,
  ProgramConfigSchema,
  ProgramDefinitionSchema,
  ProgramInstanceSchema,
  type CatalogEntry,
  type GenericProgramDetail,
  type ProgramDefinition,
  type ProgramInstance,
} from '@gzclp/domain';
import { isRecord } from '@gzclp/domain/type-guards';

import {
  assertAuthorizedSessionCurrent,
  ObsoleteAuthorizedSessionError,
  type AuthorizedSession,
} from '../auth/session';
import { bootstrapDatabase, getDatabase } from '../db/client';
import type { DatabaseClient } from '../db/expo-sqlite-adapter';
import {
  abandonProgramRefreshLease,
  assertProgramRefreshLeaseCanCommit,
  getNewerProgramRefreshLeaseSettlement,
  markProgramRefreshLeaseCommitted,
  ObsoleteProgramRefreshLeaseError,
  withProgramMutationGenerationBarriers,
  withProgramRefreshCommitBarrier,
  withProgramRefreshMutationBarrier,
  withProgramRefreshMutationBarriers,
  type ProgramRefreshLease,
  type ProgramRefreshResource,
} from './program-refresh-generation';

export type ProgramStatus = ProgramInstance['status'];

export interface ProgramSummary {
  readonly id: string;
  readonly programId: string;
  readonly title: string;
  readonly status: ProgramStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function assertProgramWriteSessionCurrent(
  ownerUserId: string,
  session: AuthorizedSession | undefined
): void {
  if (session === undefined) {
    return;
  }
  if (session.ownerUserId !== ownerUserId) {
    throw new ObsoleteAuthorizedSessionError(true);
  }
  assertAuthorizedSessionCurrent(session, true);
}

async function commitRefreshTransaction(
  database: DatabaseClient,
  lease: ProgramRefreshLease,
  write: (transaction: DatabaseClient) => Promise<void>,
  protectWrite?: (writeTransaction: () => Promise<void>) => Promise<void>
): Promise<boolean> {
  try {
    while (true) {
      const outcome = await withProgramRefreshCommitBarrier(
        lease.ownerUserId,
        lease.resource,
        async () => {
          const newerSettlement = getNewerProgramRefreshLeaseSettlement(lease);
          if (newerSettlement !== null) {
            return { status: 'wait' as const, newerSettlement };
          }
          assertProgramRefreshLeaseCanCommit(lease);
          const writeTransaction = () =>
            database.withExclusiveTransactionAsync(async (transaction) => {
              assertProgramRefreshLeaseCanCommit(lease);
              await write(transaction);
              assertProgramRefreshLeaseCanCommit(lease);
            });
          if (protectWrite === undefined) {
            await writeTransaction();
          } else {
            await protectWrite(writeTransaction);
          }
          markProgramRefreshLeaseCommitted(lease);
          return { status: 'committed' as const };
        }
      );
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

type ProgramSnapshotResource = 'library' | 'catalog';

export type ProgramSnapshot<T> =
  | { readonly status: 'no_snapshot'; readonly data: readonly T[] }
  | {
      readonly status: 'snapshot_empty' | 'snapshot';
      readonly data: readonly T[];
      readonly syncedAt: string;
    };

export type ProgramReconciliationOperation = 'create' | 'manage' | 'delete';

export type ProgramManageExpectation =
  | { readonly type: 'rename'; readonly name: string }
  | { readonly type: 'set_status'; readonly status: ProgramStatus }
  | {
      readonly type: 'set_config';
      readonly config: Readonly<Record<string, number | string>>;
    };

export interface PendingManageReconciliation {
  readonly programInstanceId: string;
  readonly expectation: ProgramManageExpectation | null;
}

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

function parseStoredManageExpectation(value: unknown): PendingManageReconciliation {
  if (
    !isRecord(value) ||
    typeof value.entity_id !== 'string' ||
    (value.expected_name !== null && typeof value.expected_name !== 'string') ||
    (value.expected_status !== null && typeof value.expected_status !== 'string') ||
    (value.expected_config_json !== null && typeof value.expected_config_json !== 'string')
  ) {
    throw new Error('SQLite returned an invalid manage reconciliation');
  }

  const populated = [
    value.expected_name !== null,
    value.expected_status !== null,
    value.expected_config_json !== null,
  ].filter(Boolean).length;
  if (populated === 0) {
    return { programInstanceId: value.entity_id, expectation: null };
  }
  if (populated !== 1) {
    throw new Error('SQLite returned an ambiguous manage reconciliation');
  }
  if (typeof value.expected_name === 'string') {
    return {
      programInstanceId: value.entity_id,
      expectation: { type: 'rename', name: value.expected_name },
    };
  }
  const status = parseProgramStatus(value.expected_status);
  if (status !== null) {
    return {
      programInstanceId: value.entity_id,
      expectation: { type: 'set_status', status },
    };
  }
  if (typeof value.expected_config_json === 'string') {
    let configValue: unknown;
    try {
      configValue = JSON.parse(value.expected_config_json);
    } catch {
      throw new Error('SQLite returned malformed reconciliation config JSON');
    }
    return {
      programInstanceId: value.entity_id,
      expectation: {
        type: 'set_config',
        config: ProgramConfigSchema.parse(configValue),
      },
    };
  }
  throw new Error('SQLite returned an invalid manage reconciliation expectation');
}

function configsMatch(
  expected: Readonly<Record<string, number | string>>,
  actualValue: unknown
): boolean {
  const actualResult = ProgramConfigSchema.safeParse(actualValue);
  if (!actualResult.success) {
    return false;
  }
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actualResult.data).sort();
  return (
    expectedKeys.length === actualKeys.length &&
    expectedKeys.every(
      (key, index) => key === actualKeys[index] && expected[key] === actualResult.data[key]
    )
  );
}

function expectationMatchesDetail(
  reconciliation: PendingManageReconciliation,
  detail: GenericProgramDetail
): boolean {
  const expectation = reconciliation.expectation;
  if (expectation === null) {
    return false;
  }
  if (expectation.type === 'rename') {
    return detail.name === expectation.name;
  }
  if (expectation.type === 'set_status') {
    return detail.status === expectation.status;
  }
  return configsMatch(expectation.config, detail.config);
}

export function programManageExpectationsMatch(
  first: ProgramManageExpectation,
  second: ProgramManageExpectation
): boolean {
  if (first.type !== second.type) {
    return false;
  }
  if (first.type === 'rename' && second.type === 'rename') {
    return first.name.trim() === second.name.trim();
  }
  if (first.type === 'set_status' && second.type === 'set_status') {
    return first.status === second.status;
  }
  return (
    first.type === 'set_config' &&
    second.type === 'set_config' &&
    configsMatch(first.config, second.config)
  );
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
  programs: readonly ProgramSummary[],
  snapshotSyncedAt: string | null
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
       AND operation = 'create'
       AND entity_id NOT LIKE 'unknown:%'
       AND EXISTS (
         SELECT 1
         FROM mobile_v2_program_summaries
         WHERE owner_user_id = ? AND id = mobile_v2_program_reconciliations.entity_id
       )`,
    ownerUserId,
    ownerUserId
  );

  if (snapshotSyncedAt !== null) {
    await upsertSnapshotMetadata(transaction, ownerUserId, 'library', snapshotSyncedAt);
  }
}

function parseProgramIdRows(values: readonly unknown[]): string[] {
  return values.map((value) => {
    if (!isRecord(value) || typeof value.id !== 'string') {
      throw new Error('SQLite returned an invalid program identifier row');
    }
    return value.id;
  });
}

async function listCachedProgramIdsMissingFromSnapshot(
  database: DatabaseClient,
  ownerUserId: string,
  programs: readonly ProgramSummary[]
): Promise<string[]> {
  const rows = await database.getAllAsync(
    `SELECT id
     FROM mobile_v2_program_summaries
     WHERE owner_user_id = ?
     UNION
     SELECT id
     FROM mobile_v2_program_details
     WHERE owner_user_id = ?`,
    ownerUserId,
    ownerUserId
  );
  const snapshotIds = new Set(programs.map((program) => program.id));
  return parseProgramIdRows(rows).filter((id) => !snapshotIds.has(id));
}

async function listOtherActiveProgramIds(
  database: DatabaseClient,
  ownerUserId: string,
  programInstanceId: string
): Promise<string[]> {
  const rows = await database.getAllAsync(
    `SELECT id
     FROM mobile_v2_program_summaries
     WHERE owner_user_id = ? AND id <> ? AND status = 'active'
     UNION
     SELECT id
     FROM mobile_v2_program_details
     WHERE owner_user_id = ?
       AND id <> ?
       AND json_extract(detail_json, '$.status') = 'active'`,
    ownerUserId,
    programInstanceId,
    ownerUserId,
    programInstanceId
  );
  return parseProgramIdRows(rows);
}

function detailResources(programIds: readonly string[]): ProgramRefreshResource[] {
  return programIds.map((programId): ProgramRefreshResource => `detail:${programId}`);
}

async function upsertSnapshotMetadata(
  transaction: DatabaseClient,
  ownerUserId: string,
  resource: ProgramSnapshotResource,
  syncedAt: string
): Promise<void> {
  await transaction.runAsync(
    `INSERT INTO mobile_v2_program_snapshots (
       owner_user_id, resource, synced_at
     ) VALUES (?, ?, ?)
     ON CONFLICT(owner_user_id, resource) DO UPDATE SET
       synced_at = excluded.synced_at`,
    ownerUserId,
    resource,
    syncedAt
  );
}

async function readSnapshotMetadata(
  database: DatabaseClient,
  ownerUserId: string,
  resource: ProgramSnapshotResource
): Promise<string | null> {
  const rows = await database.getAllAsync(
    `SELECT synced_at
     FROM mobile_v2_program_snapshots
     WHERE owner_user_id = ? AND resource = ?
     LIMIT 1`,
    ownerUserId,
    resource
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  if (!isRecord(row) || typeof row.synced_at !== 'string') {
    throw new Error('SQLite returned invalid program snapshot metadata');
  }
  return row.synced_at;
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

  await withProgramRefreshMutationBarrier(ownerUserId, 'library', async () => {
    const removedProgramIds = await listCachedProgramIdsMissingFromSnapshot(
      database,
      ownerUserId,
      programs
    );
    await withProgramRefreshMutationBarriers(ownerUserId, detailResources(removedProgramIds), () =>
      database.withExclusiveTransactionAsync((transaction) =>
        replaceSummaries(transaction, ownerUserId, programs, new Date().toISOString())
      )
    );
  });
}

export async function commitProgramSummariesRefresh(
  lease: ProgramRefreshLease,
  programs: readonly ProgramSummary[]
): Promise<boolean> {
  requireOwnerUserId(lease.ownerUserId);
  if (lease.resource !== 'library') {
    return false;
  }
  const database = getDatabase();
  await bootstrapDatabase(database);

  return commitRefreshTransaction(
    database,
    lease,
    async (transaction) => {
      await replaceSummaries(transaction, lease.ownerUserId, programs, new Date().toISOString());
    },
    async (writeTransaction) => {
      const removedProgramIds = await listCachedProgramIdsMissingFromSnapshot(
        database,
        lease.ownerUserId,
        programs
      );
      await withProgramRefreshMutationBarriers(
        lease.ownerUserId,
        detailResources(removedProgramIds),
        writeTransaction
      );
    }
  );
}

async function listProgramSummariesFromDatabase(
  database: DatabaseClient,
  ownerUserId: string
): Promise<ProgramSummary[]> {
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

export async function listProgramSummaries(ownerUserId: string): Promise<ProgramSummary[]> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);
  return listProgramSummariesFromDatabase(database, ownerUserId);
}

export async function readProgramLibrarySnapshot(
  ownerUserId: string
): Promise<ProgramSnapshot<ProgramSummary>> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  let syncedAt: string | null = null;
  let data: readonly ProgramSummary[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    syncedAt = await readSnapshotMetadata(transaction, ownerUserId, 'library');
    data = await listProgramSummariesFromDatabase(transaction, ownerUserId);
  });
  if (syncedAt === null) {
    return { status: 'no_snapshot', data };
  }
  return {
    status: data.length === 0 ? 'snapshot_empty' : 'snapshot',
    data,
    syncedAt,
  };
}

export async function replaceCachedCatalog(
  ownerUserId: string,
  entries: readonly CatalogEntry[]
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  await withProgramRefreshMutationBarrier(ownerUserId, 'catalog', () =>
    database.withExclusiveTransactionAsync(async (transaction) => {
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
      await upsertSnapshotMetadata(transaction, ownerUserId, 'catalog', new Date().toISOString());
    })
  );
}

export async function commitProgramCatalogRefresh(
  lease: ProgramRefreshLease,
  entries: readonly CatalogEntry[]
): Promise<boolean> {
  requireOwnerUserId(lease.ownerUserId);
  if (lease.resource !== 'catalog') {
    return false;
  }
  const database = getDatabase();
  await bootstrapDatabase(database);

  return commitRefreshTransaction(database, lease, async (transaction) => {
    await transaction.runAsync(
      'DELETE FROM mobile_v2_program_catalog WHERE owner_user_id = ?',
      lease.ownerUserId
    );
    for (const entry of entries) {
      await transaction.runAsync(
        `INSERT INTO mobile_v2_program_catalog (
           owner_user_id, id, entry_json, updated_at
         ) VALUES (?, ?, ?, ?)`,
        lease.ownerUserId,
        entry.id,
        JSON.stringify(entry),
        new Date().toISOString()
      );
    }
    await upsertSnapshotMetadata(
      transaction,
      lease.ownerUserId,
      'catalog',
      new Date().toISOString()
    );
  });
}

async function listCachedCatalogFromDatabase(
  database: DatabaseClient,
  ownerUserId: string
): Promise<CatalogEntry[]> {
  const rows = await database.getAllAsync(
    `SELECT entry_json
     FROM mobile_v2_program_catalog
     WHERE owner_user_id = ?
     ORDER BY id`,
    ownerUserId
  );

  return rows.map(parseCatalogRow).map((row) => parseCatalogEntryJson(row.entry_json));
}

export async function listCachedCatalog(ownerUserId: string): Promise<CatalogEntry[]> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);
  return listCachedCatalogFromDatabase(database, ownerUserId);
}

export async function readProgramCatalogSnapshot(
  ownerUserId: string
): Promise<ProgramSnapshot<CatalogEntry>> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  let syncedAt: string | null = null;
  let data: readonly CatalogEntry[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    syncedAt = await readSnapshotMetadata(transaction, ownerUserId, 'catalog');
    data = await listCachedCatalogFromDatabase(transaction, ownerUserId);
  });
  if (syncedAt === null) {
    return { status: 'no_snapshot', data };
  }
  return {
    status: data.length === 0 ? 'snapshot_empty' : 'snapshot',
    data,
    syncedAt,
  };
}

export async function cacheCreatedProgram(input: {
  readonly ownerUserId: string;
  readonly session?: AuthorizedSession;
  readonly libraryLease: ProgramRefreshLease;
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
  const lease = input.libraryLease;
  if (lease.ownerUserId !== input.ownerUserId || lease.resource !== 'library') {
    throw new Error('Created program cache requires its library producer lease');
  }
  const writeSession = input.session ?? lease.session;

  try {
    await withProgramRefreshCommitBarrier(input.ownerUserId, 'library', async () => {
      assertProgramRefreshLeaseCanCommit(lease);
      const affectedProgramIds =
        input.serverPrograms === null
          ? await listOtherActiveProgramIds(database, input.ownerUserId, detail.id)
          : await listCachedProgramIdsMissingFromSnapshot(
              database,
              input.ownerUserId,
              input.serverPrograms
            );
      await withProgramRefreshMutationBarriers(
        input.ownerUserId,
        [
          `definition:${definition.id}`,
          `detail:${detail.id}`,
          ...detailResources(affectedProgramIds),
        ],
        async () => {
          assertProgramRefreshLeaseCanCommit(lease);
          await database.withExclusiveTransactionAsync(async (transaction) => {
            assertProgramWriteSessionCurrent(input.ownerUserId, writeSession);
            assertProgramRefreshLeaseCanCommit(lease);
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
              await replaceSummaries(
                transaction,
                input.ownerUserId,
                input.serverPrograms,
                new Date().toISOString()
              );
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
            assertProgramWriteSessionCurrent(input.ownerUserId, writeSession);
            assertProgramRefreshLeaseCanCommit(lease);
          });
          markProgramRefreshLeaseCommitted(lease);
        }
      );
    });
  } catch (error) {
    await abandonProgramRefreshLease(lease);
    throw error;
  }
}

async function cacheManagedProgramInTransaction(
  transaction: DatabaseClient,
  ownerUserId: string,
  detail: GenericProgramDetail,
  options: {
    readonly session?: AuthorizedSession;
    readonly activationRequested: boolean;
    readonly mutation: ProgramManageExpectation;
  }
): Promise<void> {
  const pendingRows = await transaction.getAllAsync(
    `SELECT entity_id, expected_name, expected_status, expected_config_json
     FROM mobile_v2_program_reconciliations
     WHERE owner_user_id = ?
       AND operation = 'manage'
       AND entity_id = ?
     LIMIT 1`,
    ownerUserId,
    detail.id
  );
  const pending =
    pendingRows[0] === undefined ? null : parseStoredManageExpectation(pendingRows[0]);
  const pendingExpectation = pending?.expectation ?? null;
  const resolvesPending =
    pending !== null &&
    pendingExpectation !== null &&
    programManageExpectationsMatch(pendingExpectation, options.mutation) &&
    expectationMatchesDetail(pending, detail);
  if (!resolvesPending) {
    throw new Error('Management ACK does not match the durable expectation');
  }
  const summary = toSummary(detail);
  const activating =
    summary.status === 'active' &&
    (options.activationRequested ||
      (pendingExpectation.type === 'set_status' && pendingExpectation.status === 'active'));

  if (activating) {
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
           AND json_extract(detail_json, '$.status') = 'active'`,
      detail.updatedAt,
      detail.updatedAt,
      ownerUserId,
      detail.id
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
  if (options.mutation.type === 'set_config') {
    await transaction.runAsync(
      `UPDATE mobile_v2_program_details
       SET detail_json = json_set(detail_json, '$.config', json(?)),
           updated_at = ?
       WHERE owner_user_id = ? AND id = ?`,
      JSON.stringify(detail.config),
      detail.updatedAt,
      ownerUserId,
      detail.id
    );
  }
  if (summary.status !== 'active') {
    await transaction.runAsync(
      `UPDATE mobile_v2_program_preferences
         SET pinned_program_id = NULL, updated_at = ?
         WHERE owner_user_id = ? AND pinned_program_id = ?`,
      new Date().toISOString(),
      ownerUserId,
      detail.id
    );
  } else if (activating) {
    await transaction.runAsync(
      `INSERT INTO mobile_v2_program_preferences (
         owner_user_id, pinned_program_id, updated_at
       ) VALUES (?, ?, ?)
       ON CONFLICT(owner_user_id) DO UPDATE SET
         pinned_program_id = excluded.pinned_program_id,
         updated_at = excluded.updated_at`,
      ownerUserId,
      detail.id,
      new Date().toISOString()
    );
  }
  await transaction.runAsync(
    `DELETE FROM mobile_v2_program_reconciliations
     WHERE owner_user_id = ? AND operation = 'manage' AND entity_id = ?`,
    ownerUserId,
    detail.id
  );
}

export async function cacheManagedProgram(
  ownerUserId: string,
  detailValue: GenericProgramDetail,
  options: {
    readonly session?: AuthorizedSession;
    readonly activationRequested: boolean;
    readonly mutation: ProgramManageExpectation;
  }
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const detail = GenericProgramDetailSchema.parse(detailValue);
  const database = getDatabase();
  await bootstrapDatabase(database);

  await withProgramRefreshMutationBarrier(ownerUserId, 'library', async () => {
    const activating =
      detail.status === 'active' &&
      (options.activationRequested ||
        (options.mutation.type === 'set_status' && options.mutation.status === 'active'));
    const affectedProgramIds = activating
      ? await listOtherActiveProgramIds(database, ownerUserId, detail.id)
      : [];
    await withProgramRefreshMutationBarriers(
      ownerUserId,
      [`detail:${detail.id}`, ...detailResources(affectedProgramIds)],
      () =>
        database.withExclusiveTransactionAsync(async (transaction) => {
          assertProgramWriteSessionCurrent(ownerUserId, options.session);
          await cacheManagedProgramInTransaction(transaction, ownerUserId, detail, options);
          assertProgramWriteSessionCurrent(ownerUserId, options.session);
        })
    );
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
  await transaction.runAsync(
    `DELETE FROM mobile_v2_program_reconciliations
     WHERE owner_user_id = ? AND entity_id = ?`,
    ownerUserId,
    programInstanceId
  );
}

export async function deleteLocalProgramData(
  ownerUserId: string,
  programInstanceId: string,
  session?: AuthorizedSession
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);

  await withProgramMutationGenerationBarriers(ownerUserId, programInstanceId, () =>
    database.withExclusiveTransactionAsync(async (transaction) => {
      assertProgramWriteSessionCurrent(ownerUserId, session);
      await deleteLocalProgramDataInTransaction(transaction, ownerUserId, programInstanceId);
      assertProgramWriteSessionCurrent(ownerUserId, session);
    })
  );
}

export async function recordProgramReconciliation(
  ownerUserId: string,
  operation: ProgramReconciliationOperation,
  entityId: string,
  expectation: ProgramManageExpectation | null = null
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  if (entityId.length === 0) {
    throw new Error('Program reconciliation requires an entity identifier');
  }
  if ((operation === 'manage') !== (expectation !== null)) {
    throw new Error('Manage reconciliation requires exactly one verifiable expectation');
  }
  const expectedName = expectation?.type === 'rename' ? expectation.name.trim() : null;
  if (expectation?.type === 'rename' && expectedName?.length === 0) {
    throw new Error('Rename reconciliation requires a non-empty expected name');
  }
  const expectedStatus = expectation?.type === 'set_status' ? expectation.status : null;
  const expectedConfig =
    expectation?.type === 'set_config'
      ? JSON.stringify(ProgramConfigSchema.parse(expectation.config))
      : null;
  const database = getDatabase();
  await bootstrapDatabase(database);

  await withProgramMutationGenerationBarriers(ownerUserId, entityId, () =>
    database.runAsync(
      `INSERT INTO mobile_v2_program_reconciliations (
       owner_user_id,
       operation,
       entity_id,
       expected_name,
       expected_status,
       expected_config_json,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_user_id, operation, entity_id) DO UPDATE SET
       expected_name = excluded.expected_name,
       expected_status = excluded.expected_status,
       expected_config_json = excluded.expected_config_json,
       created_at = excluded.created_at
     WHERE mobile_v2_program_reconciliations.operation <> 'manage'
        OR (
          mobile_v2_program_reconciliations.expected_name IS NULL
          AND mobile_v2_program_reconciliations.expected_status IS NULL
          AND mobile_v2_program_reconciliations.expected_config_json IS NULL
        )`,
      ownerUserId,
      operation,
      entityId,
      expectedName,
      expectedStatus,
      expectedConfig,
      new Date().toISOString()
    )
  );
}

export async function readPendingManageReconciliations(
  ownerUserId: string
): Promise<readonly PendingManageReconciliation[]> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);
  const rows = await database.getAllAsync(
    `SELECT entity_id, expected_name, expected_status, expected_config_json
     FROM mobile_v2_program_reconciliations
     WHERE owner_user_id = ? AND operation = 'manage'
     ORDER BY created_at, entity_id`,
    ownerUserId
  );
  return rows.map(parseStoredManageExpectation);
}

export async function readPendingDeleteReconciliations(
  ownerUserId: string
): Promise<readonly string[]> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);
  const rows = await database.getAllAsync(
    `SELECT entity_id
     FROM mobile_v2_program_reconciliations
     WHERE owner_user_id = ? AND operation = 'delete'
     ORDER BY created_at, entity_id`,
    ownerUserId
  );
  return rows.map((row) => {
    if (!isRecord(row) || typeof row.entity_id !== 'string' || row.entity_id.length === 0) {
      throw new Error('SQLite returned an invalid delete reconciliation');
    }
    return row.entity_id;
  });
}

export async function clearProgramDeleteReconciliation(
  ownerUserId: string,
  programInstanceId: string
): Promise<void> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);
  await withProgramMutationGenerationBarriers(ownerUserId, programInstanceId, () =>
    database.runAsync(
      `DELETE FROM mobile_v2_program_reconciliations
       WHERE owner_user_id = ? AND operation = 'delete' AND entity_id = ?`,
      ownerUserId,
      programInstanceId
    )
  );
}

export async function persistProgramManageExpectation(
  ownerUserId: string,
  programInstanceId: string,
  expectation: ProgramManageExpectation
): Promise<boolean> {
  await recordProgramReconciliation(ownerUserId, 'manage', programInstanceId, expectation);
  const stored = (await readPendingManageReconciliations(ownerUserId)).find(
    (entry) => entry.programInstanceId === programInstanceId
  );
  return (
    stored?.expectation !== null &&
    stored?.expectation !== undefined &&
    programManageExpectationsMatch(stored.expectation, expectation)
  );
}

export async function clearProgramManageReconciliationIfMatches(
  ownerUserId: string,
  programInstanceId: string,
  expectation: ProgramManageExpectation
): Promise<boolean> {
  requireOwnerUserId(ownerUserId);
  const database = getDatabase();
  await bootstrapDatabase(database);
  let cleared = false;
  await withProgramMutationGenerationBarriers(ownerUserId, programInstanceId, () =>
    database.withExclusiveTransactionAsync(async (transaction) => {
      const rows = await transaction.getAllAsync(
        `SELECT entity_id, expected_name, expected_status, expected_config_json
       FROM mobile_v2_program_reconciliations
       WHERE owner_user_id = ?
         AND operation = 'manage'
         AND entity_id = ?
       LIMIT 1`,
        ownerUserId,
        programInstanceId
      );
      const row = rows[0];
      if (row === undefined) {
        return;
      }
      const stored = parseStoredManageExpectation(row);
      if (
        stored.expectation === null ||
        !programManageExpectationsMatch(stored.expectation, expectation)
      ) {
        return;
      }
      await transaction.runAsync(
        `DELETE FROM mobile_v2_program_reconciliations
       WHERE owner_user_id = ? AND operation = 'manage' AND entity_id = ?`,
        ownerUserId,
        programInstanceId
      );
      cleared = true;
    })
  );
  return cleared;
}

export async function resolveProgramReconciliationWithRemoteDetail(
  ownerUserId: string,
  detailValue: GenericProgramDetail,
  session: AuthorizedSession
): Promise<boolean> {
  requireOwnerUserId(ownerUserId);
  assertProgramWriteSessionCurrent(ownerUserId, session);
  const detail = GenericProgramDetailSchema.parse(detailValue);
  const database = getDatabase();
  await bootstrapDatabase(database);
  let resolved = false;
  await withProgramMutationGenerationBarriers(ownerUserId, detail.id, () =>
    database.withExclusiveTransactionAsync(async (transaction) => {
      assertProgramWriteSessionCurrent(ownerUserId, session);
      const rows = await transaction.getAllAsync(
        `SELECT entity_id, expected_name, expected_status, expected_config_json
       FROM mobile_v2_program_reconciliations
       WHERE owner_user_id = ?
         AND operation = 'manage'
         AND entity_id = ?
       LIMIT 1`,
        ownerUserId,
        detail.id
      );
      const row = rows[0];
      if (row === undefined) {
        return;
      }
      const reconciliation = parseStoredManageExpectation(row);
      const expectation = reconciliation.expectation;
      if (expectation === null || !expectationMatchesDetail(reconciliation, detail)) {
        return;
      }
      await cacheManagedProgramInTransaction(transaction, ownerUserId, detail, {
        activationRequested: expectation.type === 'set_status' && expectation.status === 'active',
        mutation: expectation,
      });
      assertProgramWriteSessionCurrent(ownerUserId, session);
      resolved = true;
    })
  );
  return resolved;
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
