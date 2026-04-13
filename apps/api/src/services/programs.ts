/**
 * Program service — CRUD for program instances, results reconstruction.
 * Framework-agnostic: no Elysia dependency.
 */
import { eq, and, lt, desc, or, gt, asc, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db';
import {
  programInstances,
  programTemplates,
  programDefinitions,
  workoutResults,
  undoEntries,
} from '../db/schema';
import { getProgramDefinition } from '../services/catalog';
import { ProgramInstanceSchema } from '@gzclp/shared/schemas/instance';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import type { GenericResults, GenericUndoHistory } from '@gzclp/shared/types/program';
import { ApiError } from '../middleware/error-handler';
import { logger } from '../lib/logger';
import { type Result, ok, err } from '../lib/hydrate-program';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InstanceRow = typeof programInstances.$inferSelect;

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
  readonly prevResult: 'success' | 'fail' | null;
  readonly prevAmrapReps: number | null;
  readonly prevRpe: number | null;
  readonly prevSetLogs: unknown;
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
    const prevSetLogs = isSetLogsArray(row.prevSetLogs) ? row.prevSetLogs : undefined;
    return {
      i: row.workoutIndex,
      slotId: row.slotId,
      ...(row.prevResult !== null ? { prev: row.prevResult } : {}),
      ...(row.prevRpe !== null ? { prevRpe: row.prevRpe } : {}),
      ...(row.prevAmrapReps !== null ? { prevAmrapReps: row.prevAmrapReps } : {}),
      ...(prevSetLogs !== undefined ? { prevSetLogs } : {}),
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
    programId: instance.programId,
    name: instance.name,
    config: instance.config,
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
        prevResult: undoEntries.prevResult,
        prevAmrapReps: undoEntries.prevAmrapReps,
        prevRpe: undoEntries.prevRpe,
        prevSetLogs: undoEntries.prevSetLogs,
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
  // TODO(#17): When program_definitions approval flow is complete, also allow
  // instantiation from approved definitions (check program_definitions
  // WHERE status = 'approved' as fallback). See schema.ts architecture note
  // on program_templates vs program_definitions duality.
  const [template] = await getDb()
    .select({ id: programTemplates.id })
    .from(programTemplates)
    .where(and(eq(programTemplates.id, programId), eq(programTemplates.isActive, true)))
    .limit(1);

  if (!template) {
    throw new ApiError(400, `Unknown program: ${programId}`, 'INVALID_PROGRAM');
  }

  // Auto-complete any existing active program for this user (self-healing guard).
  // The DB also enforces this via a unique partial index, but handling it here
  // lets us resolve the conflict gracefully instead of throwing a constraint error.
  await getDb()
    .update(programInstances)
    .set({ status: 'completed' })
    .where(and(eq(programInstances.userId, userId), eq(programInstances.status, 'active')));

  const [instance] = await getDb()
    .insert(programInstances)
    .values({
      userId,
      programId,
      name,
      config,
      status: 'active',
    })
    .returning();

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
      programId: programInstances.programId,
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
      programId: i.programId,
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
      programId: programInstances.programId,
      definitionId: programInstances.definitionId,
      customDefinition: programInstances.customDefinition,
      name: programInstances.name,
      config: programInstances.config,
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
  type ProgramInstanceUpdate = {
    updatedAt: Date;
    name?: string;
    status?: 'active' | 'completed' | 'archived';
    config?: Record<string, number | string>;
  };
  // Value overridden by set_updated_at trigger; kept to ensure valid UPDATE
  const updateValues: ProgramInstanceUpdate = { updatedAt: new Date() };
  if (updates.name !== undefined) updateValues.name = updates.name;
  if (updates.status !== undefined) updateValues.status = updates.status;
  if (updates.config !== undefined) updateValues.config = updates.config;

  // Single UPDATE WHERE userId AND id — one round-trip instead of SELECT+UPDATE
  const [updated] = await getDb()
    .update(programInstances)
    .set(updateValues)
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .returning();

  if (!updated) {
    throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  }

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
  const MAX_METADATA_BYTES = 10_000;
  const serialized = JSON.stringify(metadata);
  if (serialized.length > MAX_METADATA_BYTES) {
    throw new ApiError(400, 'Metadata exceeds 10KB limit', 'METADATA_TOO_LARGE');
  }

  // Single UPDATE with JSONB merge — no preceding SELECT needed
  const [updated] = await getDb()
    .update(programInstances)
    .set({
      metadata: sql`COALESCE(${programInstances.metadata}, '{}'::jsonb) || ${metadata}::jsonb`,
      updatedAt: new Date(),
    })
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .returning();

  if (!updated) {
    throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  }

  const [resultRows, undoRows] = await fetchResultsAndUndo(instanceId);
  return toResponse(updated, resultRows, undoRows);
}

export async function deleteInstance(userId: string, instanceId: string): Promise<void> {
  // Single DELETE WHERE userId AND id — one round-trip instead of SELECT+DELETE
  // CASCADE deletes workout_results and undo_entries
  const deleted = await getDb()
    .delete(programInstances)
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .returning({ id: programInstances.id });

  if (deleted.length === 0) {
    throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  }
}

// ---------------------------------------------------------------------------
// Custom instance creation
// ---------------------------------------------------------------------------

export type InstantiationError =
  | 'DEFINITION_NOT_FOUND'
  | 'FORBIDDEN'
  | 'DEFINITION_INVALID'
  | 'DATABASE_ERROR';

/**
 * Create a program instance from a user-owned program definition.
 * Snapshots the definition into customDefinition for offline/fast reads.
 */
export async function createCustomInstance(
  userId: string,
  definitionId: string,
  name: string,
  config: Record<string, number | string>
): Promise<Result<ProgramInstanceResponse, InstantiationError>> {
  const db = getDb();

  // Query the definition
  const [defRow] = await db
    .select({
      id: programDefinitions.id,
      userId: programDefinitions.userId,
      definition: programDefinitions.definition,
    })
    .from(programDefinitions)
    .where(and(eq(programDefinitions.id, definitionId), eq(programDefinitions.userId, userId)))
    .limit(1);

  if (!defRow) {
    return err('DEFINITION_NOT_FOUND');
  }

  // Validate definition against ProgramDefinitionSchema
  const parseResult = ProgramDefinitionSchema.safeParse(defRow.definition);
  if (!parseResult.success) {
    logger.warn(
      { event: 'program.createCustom.validation_failed', definitionId },
      'custom definition failed validation'
    );
    return err('DEFINITION_INVALID');
  }

  const definition = parseResult.data;

  // Auto-complete any existing active instance
  await db
    .update(programInstances)
    .set({ status: 'completed' })
    .where(and(eq(programInstances.userId, userId), eq(programInstances.status, 'active')));

  try {
    const [instance] = await db
      .insert(programInstances)
      .values({
        userId,
        programId: `custom:${definitionId}`,
        definitionId,
        customDefinition: definition,
        name,
        config,
        status: 'active',
      })
      .returning();

    if (!instance) {
      return err('DATABASE_ERROR');
    }

    logger.info(
      { event: 'program.createCustom', userId, definitionId, instanceId: instance.id },
      'custom program instance created'
    );

    return ok(toResponse(instance, [], []));
  } catch (e: unknown) {
    logger.error(
      { event: 'program.createCustom.error', definitionId, error: e },
      'custom instance creation database error'
    );
    return err('DATABASE_ERROR');
  }
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
  };
}

export async function importInstance(
  userId: string,
  data: ExportedProgram
): Promise<ProgramInstanceResponse> {
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
  const validSlotIds = new Set(definition.days.flatMap((d) => d.slots.map((s) => s.id)));

  for (const [indexStr, slots] of Object.entries(data.results)) {
    const idx = Number(indexStr);
    if (!Number.isInteger(idx) || idx < 0 || idx > maxWorkoutIndex) {
      throw new ApiError(400, `Invalid workoutIndex: ${indexStr}`, 'INVALID_DATA');
    }
    for (const [slotId, slotData] of Object.entries(slots)) {
      if (!validSlotIds.has(slotId)) {
        throw new ApiError(400, `Unknown slotId: ${slotId}`, 'INVALID_DATA');
      }
      if (slotData.amrapReps !== undefined && slotData.amrapReps > 99) {
        throw new ApiError(400, 'amrapReps cannot exceed 99', 'INVALID_DATA');
      }
    }
  }

  // Wrap all inserts in a transaction — partial failure rolls back everything
  const instanceId = await getDb().transaction(async (tx) => {
    const [instance] = await tx
      .insert(programInstances)
      .values({
        userId,
        programId: data.programId,
        name: data.name,
        config,
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
    }[] = [];

    for (const [indexStr, slots] of Object.entries(data.results)) {
      for (const [slotId, slotResult] of Object.entries(slots)) {
        if (slotResult.result) {
          resultValues.push({
            instanceId: instance.id,
            workoutIndex: Number(indexStr),
            slotId,
            result: slotResult.result,
            amrapReps: slotResult.amrapReps ?? null,
            rpe: slotResult.rpe ?? null,
            setLogs: slotResult.setLogs ?? null,
          });
        }
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
        prevResult: entry.prev ?? null,
        prevRpe: entry.prevRpe ?? null,
        prevAmrapReps: entry.prevAmrapReps ?? null,
        prevSetLogs: entry.prevSetLogs ?? null,
      }));
      await tx.insert(undoEntries).values(undoValues);
    }

    return instance.id;
  });

  // Fetch and return the full response after the transaction commits
  return getInstance(userId, instanceId);
}
