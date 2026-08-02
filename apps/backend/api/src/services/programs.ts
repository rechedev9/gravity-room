/**
 * Program service — CRUD for program instances, results reconstruction.
 * Framework-agnostic: no Elysia dependency.
 */
import { eq, and, lt, desc, or, gt, asc, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db';
import {
  programInstances,
  programTemplates,
  workoutResults,
  undoEntries,
} from '@gzclp/database/schema';
import { getProgramDefinition } from '../services/catalog';
import {
  GenericUndoHistorySchema,
  ProgramInstanceSchema,
  SetLogEntrySchema,
} from '@gzclp/domain/schemas/instance';
import type { GenericResults, GenericUndoHistory } from '@gzclp/domain/types/program';
import { ApiError } from '../middleware/error-handler';
import {
  MAX_IMPORT_JSON_BYTES,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_UNDO_ENTRIES,
} from '../lib/data-limits';
import { assertUserDataQuotas, lockUserForDataMutation } from './data-quotas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InstanceRow = typeof programInstances.$inferSelect;
type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/** Projected columns from workout_results — only what helpers actually use. */
interface ResultProjection {
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result: 'success' | 'fail';
  readonly amrapReps: number | null;
  readonly rpe: number | null;
  readonly setLogs: unknown;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
}

/** Projected columns from undo_entries — only what buildUndoHistory uses. */
interface UndoProjection {
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly previousResult: 'success' | 'fail' | null;
  readonly previousAmrapReps: number | null;
  readonly previousRpe: number | null;
  readonly previousSetLogs: unknown;
}

export interface ProgramInstanceResponse {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly config: unknown;
  readonly metadata: unknown;
  readonly status: string;
  readonly results: GenericResults;
  readonly undoHistory: GenericUndoHistory;
  readonly resultTimestamps: Readonly<Record<string, string>>;
  readonly completedDates: Readonly<Record<string, string>>;
  readonly definitionId: string | null;
  readonly customDefinition: unknown | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_AMRAP_REPS = 99;
const MAX_SET_LOG_ITEMS = 20;
const MAX_SET_LOG_WEIGHT = 10_000;
const MAX_METADATA_BYTES = 10_000;

async function lockUserForActiveProgramMutation(tx: Tx, userId: string): Promise<void> {
  await lockUserForDataMutation(tx, userId);
}

/** Maps each workoutIndex to the earliest createdAt timestamp for that workout. */
function buildResultTimestamps(rows: readonly ResultProjection[]): Record<string, string> {
  const timestamps: Record<string, string> = {};
  for (const row of rows) {
    const key = String(row.workoutIndex);
    const ts = row.createdAt.toISOString();
    if (!timestamps[key] || ts < timestamps[key]) {
      timestamps[key] = ts;
    }
  }
  return timestamps;
}

/** Validates that a JSONB value is a set logs array. */
function isSetLogsArray(
  value: unknown
): value is Array<{ reps: number; weight?: number; rpe?: number }> {
  return Array.isArray(value) && value.every((v) => typeof v === 'object' && v !== null);
}

/** Reconstructs GenericResults from normalized workout_results rows. */
function buildGenericResults(rows: readonly ResultProjection[]): GenericResults {
  const results: GenericResults = {};

  for (const row of rows) {
    const indexStr = String(row.workoutIndex);
    if (!results[indexStr]) {
      results[indexStr] = {};
    }
    const setLogs = isSetLogsArray(row.setLogs) ? row.setLogs : undefined;
    results[indexStr][row.slotId] = {
      result: row.result,
      ...(row.amrapReps !== null ? { amrapReps: row.amrapReps } : {}),
      ...(row.rpe !== null ? { rpe: row.rpe } : {}),
      ...(setLogs !== undefined ? { setLogs } : {}),
    };
  }

  return results;
}

/** Reconstructs GenericUndoHistory from undo_entries rows. */
function buildUndoHistory(rows: readonly UndoProjection[]): GenericUndoHistory {
  return rows.map((row) => {
    const previousSetLogs = isSetLogsArray(row.previousSetLogs) ? row.previousSetLogs : undefined;
    return {
      i: row.workoutIndex,
      slotId: row.slotId,
      ...(row.previousResult !== null ? { prev: row.previousResult } : {}),
      ...(row.previousRpe !== null ? { prevRpe: row.previousRpe } : {}),
      ...(row.previousAmrapReps !== null ? { prevAmrapReps: row.previousAmrapReps } : {}),
      ...(previousSetLogs !== undefined ? { prevSetLogs: previousSetLogs } : {}),
    };
  });
}

/**
 * Builds a map of workoutIndex -> ISO timestamp for completed workouts.
 * Uses the first non-null completed_at found for each workout index.
 */
function buildCompletedDates(rows: readonly ResultProjection[]): Record<string, string> {
  const dates: Record<string, string> = {};
  for (const row of rows) {
    if (row.completedAt === null) continue;
    const key = String(row.workoutIndex);
    if (!dates[key]) {
      dates[key] = row.completedAt.toISOString();
    }
  }
  return dates;
}

function toResponse(
  instance: InstanceRow,
  resultRows: readonly ResultProjection[],
  undoRows: readonly UndoProjection[]
): ProgramInstanceResponse {
  return {
    id: instance.id,
    programId: instance.templateId,
    name: instance.name,
    config: instance.programConfig,
    metadata: instance.metadata ?? null,
    status: instance.status,
    results: buildGenericResults(resultRows),
    undoHistory: buildUndoHistory(undoRows),
    resultTimestamps: buildResultTimestamps(resultRows),
    completedDates: buildCompletedDates(resultRows),
    definitionId: instance.definitionId ?? null,
    customDefinition: instance.customDefinition ?? null,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  };
}

/** Fetches results + undo rows in parallel with column projection (no SELECT *). */
async function fetchResultsAndUndo(
  instanceId: string
): Promise<readonly [readonly ResultProjection[], readonly UndoProjection[]]> {
  return Promise.all([
    getDb()
      .select({
        workoutIndex: workoutResults.workoutIndex,
        slotId: workoutResults.slotId,
        result: workoutResults.result,
        amrapReps: workoutResults.amrapReps,
        rpe: workoutResults.rpe,
        setLogs: workoutResults.setLogs,
        completedAt: workoutResults.completedAt,
        createdAt: workoutResults.createdAt,
      })
      .from(workoutResults)
      .where(eq(workoutResults.instanceId, instanceId)),
    getDb()
      .select({
        workoutIndex: undoEntries.workoutIndex,
        slotId: undoEntries.slotId,
        previousResult: undoEntries.previousResult,
        previousAmrapReps: undoEntries.previousAmrapReps,
        previousRpe: undoEntries.previousRpe,
        previousSetLogs: undoEntries.previousSetLogs,
      })
      .from(undoEntries)
      .where(eq(undoEntries.instanceId, instanceId))
      .orderBy(undoEntries.id),
  ]);
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function createInstance(
  userId: string,
  programId: string,
  name: string,
  config: Record<string, number | string>
): Promise<ProgramInstanceResponse> {
  // Validate program exists in the curated catalog (program_templates).
  const [template] = await getDb()
    .select({ id: programTemplates.id })
    .from(programTemplates)
    .where(and(eq(programTemplates.id, programId), eq(programTemplates.isActive, true)))
    .limit(1);

  if (!template) {
    throw new ApiError(400, `Unknown program: ${programId}`, 'INVALID_PROGRAM');
  }

  const instance = await getDb().transaction(async (tx) => {
    // Serialize active-program replacement per user. This makes completing the
    // previous program and inserting its replacement one atomic operation.
    await lockUserForActiveProgramMutation(tx, userId);
    await tx
      .update(programInstances)
      .set({ status: 'completed' })
      .where(and(eq(programInstances.userId, userId), eq(programInstances.status, 'active')));

    const [created] = await tx
      .insert(programInstances)
      .values({
        userId,
        templateId: programId,
        name,
        programConfig: config,
        status: 'active',
      })
      .returning();

    await assertUserDataQuotas(tx, userId);
    return created;
  });

  if (!instance) {
    throw new ApiError(500, 'Failed to create program instance', 'CREATE_FAILED');
  }

  return toResponse(instance, [], []);
}

interface ProgramInstanceListItem {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface PaginatedInstances {
  readonly data: ProgramInstanceListItem[];
  readonly nextCursor: string | null;
}

/** Parse a composite cursor `<isoTimestamp>_<uuid>` into its components. */
function parseCursor(cursor: string): { readonly ts: Date; readonly id: string } | undefined {
  const separatorIndex = cursor.lastIndexOf('_');
  if (separatorIndex === -1) return undefined;
  const tsStr = cursor.substring(0, separatorIndex);
  const id = cursor.substring(separatorIndex + 1);
  const ts = new Date(tsStr);
  if (isNaN(ts.getTime())) return undefined;
  if (id.length === 0) return undefined;
  return { ts, id };
}

export async function getInstances(
  userId: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<PaginatedInstances> {
  const limit = Math.min(options.limit ?? 20, 100);

  let conditions: SQL | undefined = eq(programInstances.userId, userId);

  if (options.cursor) {
    const parsed = parseCursor(options.cursor);
    if (!parsed) {
      throw new ApiError(400, 'Invalid cursor format', 'INVALID_CURSOR');
    }
    conditions = and(
      eq(programInstances.userId, userId),
      or(
        lt(programInstances.createdAt, parsed.ts),
        and(eq(programInstances.createdAt, parsed.ts), gt(programInstances.id, parsed.id))
      )
    );
  }

  const rows = await getDb()
    .select({
      id: programInstances.id,
      templateId: programInstances.templateId,
      name: programInstances.name,
      status: programInstances.status,
      createdAt: programInstances.createdAt,
      updatedAt: programInstances.updatedAt,
    })
    .from(programInstances)
    .where(conditions)
    .orderBy(desc(programInstances.createdAt), asc(programInstances.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = page[page.length - 1];
  const nextCursor = hasMore && lastRow ? `${lastRow.createdAt.toISOString()}_${lastRow.id}` : null;

  return {
    data: page.map((i) => ({
      id: i.id,
      programId: i.templateId,
      name: i.name,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    nextCursor,
  };
}

export async function getInstance(
  userId: string,
  instanceId: string
): Promise<ProgramInstanceResponse> {
  const [instance] = await getDb()
    .select({
      id: programInstances.id,
      userId: programInstances.userId,
      templateId: programInstances.templateId,
      definitionId: programInstances.definitionId,
      customDefinition: programInstances.customDefinition,
      name: programInstances.name,
      programConfig: programInstances.programConfig,
      metadata: programInstances.metadata,
      status: programInstances.status,
      createdAt: programInstances.createdAt,
      updatedAt: programInstances.updatedAt,
    })
    .from(programInstances)
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .limit(1);

  if (!instance) {
    throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  }

  const [resultRows, undoRows] = await fetchResultsAndUndo(instanceId);

  return toResponse(instance, resultRows, undoRows);
}

export async function updateInstance(
  userId: string,
  instanceId: string,
  updates: {
    name?: string;
    status?: 'active' | 'completed' | 'archived';
    config?: Record<string, number | string>;
  }
): Promise<ProgramInstanceResponse> {
  // updatedAt value is overridden by the set_updated_at trigger; kept to ensure valid UPDATE
  const updateValues: {
    updatedAt: Date;
    name?: string;
    status?: 'active' | 'completed' | 'archived';
    programConfig?: Record<string, number | string>;
  } = { updatedAt: new Date() };
  if (updates.name !== undefined) updateValues.name = updates.name;
  if (updates.status !== undefined) updateValues.status = updates.status;
  if (updates.config !== undefined) updateValues.programConfig = updates.config;

  const updated = await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    const [row] = await tx
      .update(programInstances)
      .set(updateValues)
      .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
      .returning();
    if (!row) throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
    await assertUserDataQuotas(tx, userId);
    return row;
  });

  const [resultRows, undoRows] = await fetchResultsAndUndo(instanceId);
  return toResponse(updated, resultRows, undoRows);
}

/**
 * Update instance metadata with shallow-merge semantics.
 * Uses PostgreSQL JSONB `||` operator to merge at the database level
 * in a single UPDATE — no preceding SELECT needed.
 */
export async function updateInstanceMetadata(
  userId: string,
  instanceId: string,
  metadata: Record<string, string | number | boolean | null>
): Promise<ProgramInstanceResponse> {
  // Validate incoming patch size before sending to DB
  const serialized = JSON.stringify(metadata);
  if (serialized.length > MAX_METADATA_BYTES) {
    throw new ApiError(400, 'Metadata exceeds 10KB limit', 'METADATA_TOO_LARGE');
  }

  const mergedMetadata = sql`COALESCE(${programInstances.metadata}, '{}'::jsonb) || ${metadata}::jsonb`;

  const updated = await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    const [row] = await tx
      .update(programInstances)
      .set({ metadata: mergedMetadata, updatedAt: new Date() })
      .where(
        and(
          eq(programInstances.id, instanceId),
          eq(programInstances.userId, userId),
          sql`length((${mergedMetadata})::text) <= ${MAX_METADATA_BYTES}`
        )
      )
      .returning();

    if (!row) {
      const [existing] = await tx
        .select({ id: programInstances.id })
        .from(programInstances)
        .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
        .limit(1);
      if (existing) throw new ApiError(400, 'Metadata exceeds 10KB limit', 'METADATA_TOO_LARGE');
      throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
    }
    await assertUserDataQuotas(tx, userId);
    return row;
  });

  const [resultRows, undoRows] = await fetchResultsAndUndo(instanceId);
  return toResponse(updated, resultRows, undoRows);
}

export async function deleteInstance(userId: string, instanceId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    const deleted = await tx
      .delete(programInstances)
      .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
      .returning({ id: programInstances.id });
    if (deleted.length === 0) {
      throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
    }
  });
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

export interface ExportedProgram {
  readonly version: 1;
  readonly exportDate: string;
  readonly programId: string;
  readonly name: string;
  readonly config: unknown;
  readonly results: GenericResults;
  readonly undoHistory: GenericUndoHistory;
  readonly completedDates?: Readonly<Record<string, string>>;
}

function assertSetLogEntriesValid(
  setLogs: readonly unknown[] | undefined,
  fieldName: string
): void {
  if (setLogs === undefined) return;
  if (setLogs.length > MAX_SET_LOG_ITEMS) {
    throw new ApiError(
      400,
      `${fieldName} cannot exceed ${MAX_SET_LOG_ITEMS} entries`,
      'INVALID_DATA'
    );
  }
  for (const setLog of setLogs) {
    const parsed = SetLogEntrySchema.safeParse(setLog);
    if (!parsed.success) {
      throw new ApiError(400, `Invalid ${fieldName} entry`, 'INVALID_DATA');
    }
    if (parsed.data.weight !== undefined && parsed.data.weight > MAX_SET_LOG_WEIGHT) {
      throw new ApiError(
        400,
        `${fieldName}.weight cannot exceed ${MAX_SET_LOG_WEIGHT}`,
        'INVALID_DATA'
      );
    }
  }
}

export async function exportInstance(userId: string, instanceId: string): Promise<ExportedProgram> {
  const instance = await getInstance(userId, instanceId);

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    programId: instance.programId,
    name: instance.name,
    config: instance.config,
    results: instance.results,
    undoHistory: instance.undoHistory,
    completedDates: instance.completedDates,
  };
}

function assertImportAggregateLimits(data: ExportedProgram): void {
  let resultRows = 0;
  for (const slots of Object.values(data.results)) {
    for (const result of Object.values(slots)) {
      if (result.result !== undefined) resultRows += 1;
    }
  }
  const totalRows = resultRows + data.undoHistory.length;
  if (data.undoHistory.length > MAX_IMPORT_UNDO_ENTRIES || totalRows > MAX_IMPORT_ROWS) {
    throw new ApiError(413, 'Import contains too many rows', 'IMPORT_TOO_LARGE');
  }
  const jsonBytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
  if (jsonBytes > MAX_IMPORT_JSON_BYTES) {
    throw new ApiError(413, 'Import payload is too large', 'IMPORT_TOO_LARGE');
  }
}

export async function importInstance(
  userId: string,
  data: ExportedProgram
): Promise<ProgramInstanceResponse> {
  // Reject amplified shapes before catalog hydration or transaction allocation.
  assertImportAggregateLimits(data);

  // Validate program exists in DB and get its hydrated definition for validation
  const defResult = await getProgramDefinition(data.programId);
  if (defResult.status === 'not_found') {
    throw new ApiError(400, `Unknown program: ${data.programId}`, 'INVALID_PROGRAM');
  }
  if (defResult.status === 'hydration_failed') {
    throw new ApiError(500, 'Program definition hydration failed', 'HYDRATION_FAILED');
  }
  const definition = defResult.definition;

  // Validate and parse config
  const configResult = ProgramInstanceSchema.shape.config.safeParse(data.config);
  if (!configResult.success) {
    throw new ApiError(400, 'Invalid config format', 'INVALID_DATA');
  }
  const config = configResult.data;

  // Validate workoutIndex bounds and slotIds against the program definition
  const maxWorkoutIndex = definition.totalWorkouts - 1;
  const cycleLength = definition.days.length;
  const completedDates = data.completedDates ?? {};
  const completedDatesByWorkout = new Map<number, string>();
  for (const [indexStr, completedDate] of Object.entries(completedDates)) {
    const idx = Number(indexStr);
    if (
      !Number.isInteger(idx) ||
      idx < 0 ||
      idx > maxWorkoutIndex ||
      !Number.isFinite(Date.parse(completedDate)) ||
      completedDatesByWorkout.has(idx)
    ) {
      throw new ApiError(400, `Invalid completion date for workout ${indexStr}`, 'INVALID_DATA');
    }
    completedDatesByWorkout.set(idx, completedDate);
  }

  for (const [indexStr, slots] of Object.entries(data.results)) {
    const idx = Number(indexStr);
    if (!Number.isInteger(idx) || idx < 0 || idx > maxWorkoutIndex) {
      throw new ApiError(400, `Invalid workoutIndex: ${indexStr}`, 'INVALID_DATA');
    }
    const day = definition.days[idx % cycleLength];
    const validSlotIds = new Set(day.slots.map((slot) => slot.id));
    for (const [slotId, slotData] of Object.entries(slots)) {
      if (!validSlotIds.has(slotId)) {
        throw new ApiError(
          400,
          `Unknown slotId for workout ${indexStr}: ${slotId}`,
          'INVALID_DATA'
        );
      }
      if (slotData.amrapReps !== undefined && slotData.amrapReps > MAX_AMRAP_REPS) {
        throw new ApiError(400, `amrapReps cannot exceed ${MAX_AMRAP_REPS}`, 'INVALID_DATA');
      }
      assertSetLogEntriesValid(slotData.setLogs, 'setLogs');
    }
  }

  const undoHistoryResult = GenericUndoHistorySchema.safeParse(data.undoHistory);
  if (!undoHistoryResult.success) {
    throw new ApiError(400, 'Invalid undoHistory format', 'INVALID_DATA');
  }
  for (const entry of undoHistoryResult.data) {
    if (entry.i < 0 || entry.i > maxWorkoutIndex) {
      throw new ApiError(400, `Invalid undo workoutIndex: ${entry.i}`, 'INVALID_DATA');
    }
    const day = definition.days[entry.i % cycleLength];
    const validSlotIds = new Set(day.slots.map((slot) => slot.id));
    if (!validSlotIds.has(entry.slotId)) {
      throw new ApiError(
        400,
        `Unknown undo slotId for workout ${entry.i}: ${entry.slotId}`,
        'INVALID_DATA'
      );
    }
    if (entry.prevAmrapReps !== undefined && entry.prevAmrapReps > MAX_AMRAP_REPS) {
      throw new ApiError(400, `prevAmrapReps cannot exceed ${MAX_AMRAP_REPS}`, 'INVALID_DATA');
    }
    assertSetLogEntriesValid(entry.prevSetLogs, 'prevSetLogs');
  }

  // Wrap all inserts in a transaction — partial failure rolls back everything
  const instanceId = await getDb().transaction(async (tx) => {
    // Import has the same "replace current active program" semantics as normal
    // creation. Locking the user makes concurrent create/import requests safe.
    await lockUserForActiveProgramMutation(tx, userId);
    await tx
      .update(programInstances)
      .set({ status: 'completed' })
      .where(and(eq(programInstances.userId, userId), eq(programInstances.status, 'active')));

    const [instance] = await tx
      .insert(programInstances)
      .values({
        userId,
        templateId: data.programId,
        name: data.name,
        programConfig: config,
        status: 'active',
      })
      .returning();

    if (!instance) {
      throw new ApiError(500, 'Failed to create imported instance', 'IMPORT_FAILED');
    }

    // Bulk insert results
    const resultValues: {
      instanceId: string;
      workoutIndex: number;
      slotId: string;
      result: 'success' | 'fail';
      amrapReps: number | null;
      rpe: number | null;
      setLogs: unknown;
      completedAt: Date | null;
      exerciseId: string;
      definitionVersion: number;
    }[] = [];

    for (const [indexStr, slots] of Object.entries(data.results)) {
      const workoutIndex = Number(indexStr);
      const day = definition.days[workoutIndex % cycleLength];
      const completedAt = day.slots.every((slot) => slots[slot.id]?.result !== undefined)
        ? new Date(completedDatesByWorkout.get(workoutIndex) ?? data.exportDate)
        : null;
      for (const [slotId, slotResult] of Object.entries(slots)) {
        if (!slotResult.result) continue;
        const slotDefinition = day.slots.find((slot) => slot.id === slotId);
        if (!slotDefinition) {
          throw new ApiError(400, `Unknown slotId: ${slotId}`, 'INVALID_DATA');
        }
        resultValues.push({
          instanceId: instance.id,
          workoutIndex,
          slotId,
          result: slotResult.result,
          amrapReps: slotResult.amrapReps ?? null,
          rpe: slotResult.rpe ?? null,
          setLogs: slotResult.setLogs ?? null,
          completedAt,
          exerciseId: slotDefinition.exerciseId,
          definitionVersion: definition.version,
        });
      }
    }

    if (resultValues.length > 0) {
      await tx.insert(workoutResults).values(resultValues);
    }

    // Bulk insert undo entries
    if (data.undoHistory.length > 0) {
      const undoValues = data.undoHistory.map((entry) => ({
        instanceId: instance.id,
        workoutIndex: entry.i,
        slotId: entry.slotId,
        previousResult: entry.prev ?? null,
        previousRpe: entry.prevRpe ?? null,
        previousAmrapReps: entry.prevAmrapReps ?? null,
        previousSetLogs: entry.prevSetLogs ?? null,
        previousExerciseId:
          definition.days[entry.i % cycleLength]?.slots.find((slot) => slot.id === entry.slotId)
            ?.exerciseId ?? null,
        previousDefinitionVersion: definition.version,
      }));
      await tx.insert(undoEntries).values(undoValues);
    }

    await assertUserDataQuotas(tx, userId);
    return instance.id;
  });

  // Fetch and return the full response after the transaction commits
  return getInstance(userId, instanceId);
}
