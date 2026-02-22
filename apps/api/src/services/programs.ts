/**
 * Program service — CRUD for program instances, results reconstruction.
 * Framework-agnostic: no Elysia dependency.
 */
import { eq, and, lt, desc } from 'drizzle-orm';
import { getDb } from '../db';
import { programInstances, workoutResults, undoEntries } from '../db/schema';
import { getProgramDefinition } from '@gzclp/shared/programs/registry';
import { ProgramInstanceSchema } from '@gzclp/shared/schemas/instance';
import type { GenericResults, GenericUndoHistory } from '@gzclp/shared/types/program';
import { ApiError } from '../middleware/error-handler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InstanceRow = typeof programInstances.$inferSelect;
type WorkoutResultRow = typeof workoutResults.$inferSelect;
type UndoEntryRow = typeof undoEntries.$inferSelect;

export interface ProgramInstanceResponse {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly config: unknown;
  readonly status: string;
  readonly results: GenericResults;
  readonly undoHistory: GenericUndoHistory;
  readonly resultTimestamps: Readonly<Record<string, string>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps each workoutIndex to the earliest createdAt timestamp for that workout. */
function buildResultTimestamps(rows: readonly WorkoutResultRow[]): Record<string, string> {
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

/** Reconstructs GenericResults from normalized workout_results rows. */
function buildGenericResults(rows: readonly WorkoutResultRow[]): GenericResults {
  const results: GenericResults = {};

  for (const row of rows) {
    const indexStr = String(row.workoutIndex);
    if (!results[indexStr]) {
      results[indexStr] = {};
    }
    results[indexStr][row.slotId] = {
      result: row.result,
      ...(row.amrapReps !== null ? { amrapReps: row.amrapReps } : {}),
      ...(row.rpe !== null ? { rpe: row.rpe } : {}),
    };
  }

  return results;
}

/** Reconstructs GenericUndoHistory from undo_entries rows. */
function buildUndoHistory(rows: readonly UndoEntryRow[]): GenericUndoHistory {
  return rows.map((row) => ({
    i: row.workoutIndex,
    slotId: row.slotId,
    ...(row.prevResult !== null ? { prev: row.prevResult } : {}),
    ...(row.prevRpe !== null ? { prevRpe: row.prevRpe } : {}),
    ...(row.prevAmrapReps !== null ? { prevAmrapReps: row.prevAmrapReps } : {}),
  }));
}

function toResponse(
  instance: InstanceRow,
  resultRows: readonly WorkoutResultRow[],
  undoRows: readonly UndoEntryRow[]
): ProgramInstanceResponse {
  return {
    id: instance.id,
    programId: instance.programId,
    name: instance.name,
    config: instance.config,
    status: instance.status,
    results: buildGenericResults(resultRows),
    undoHistory: buildUndoHistory(undoRows),
    resultTimestamps: buildResultTimestamps(resultRows),
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function createInstance(
  userId: string,
  programId: string,
  name: string,
  config: Record<string, number>
): Promise<ProgramInstanceResponse> {
  // Validate program exists
  const definition = getProgramDefinition(programId);
  if (!definition) {
    throw new ApiError(400, `Unknown program: ${programId}`, 'INVALID_PROGRAM');
  }

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

export interface ProgramInstanceListItem {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaginatedInstances {
  readonly data: ProgramInstanceListItem[];
  readonly nextCursor: string | null;
}

export async function getInstances(
  userId: string,
  options: { limit?: number; cursor?: string } = {}
): Promise<PaginatedInstances> {
  const limit = Math.min(options.limit ?? 20, 100);

  const conditions = options.cursor
    ? and(
        eq(programInstances.userId, userId),
        lt(programInstances.createdAt, new Date(options.cursor))
      )
    : eq(programInstances.userId, userId);

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
    .orderBy(desc(programInstances.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = page[page.length - 1];
  const nextCursor = hasMore && lastRow ? lastRow.createdAt.toISOString() : null;

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
    .select()
    .from(programInstances)
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .limit(1);

  if (!instance) {
    throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  }

  // Fetch results and undo history
  const [resultRows, undoRows] = await Promise.all([
    getDb().select().from(workoutResults).where(eq(workoutResults.instanceId, instanceId)),
    getDb()
      .select()
      .from(undoEntries)
      .where(eq(undoEntries.instanceId, instanceId))
      .orderBy(undoEntries.id),
  ]);

  return toResponse(instance, resultRows, undoRows);
}

export async function updateInstance(
  userId: string,
  instanceId: string,
  updates: {
    name?: string;
    status?: 'active' | 'completed' | 'archived';
    config?: Record<string, number>;
  }
): Promise<ProgramInstanceResponse> {
  type ProgramInstanceUpdate = {
    updatedAt: Date;
    name?: string;
    status?: 'active' | 'completed' | 'archived';
    config?: Record<string, number>;
  };
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

  return getInstance(userId, instanceId);
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
  // Validate program exists
  const definition = getProgramDefinition(data.programId);
  if (!definition) {
    throw new ApiError(400, `Unknown program: ${data.programId}`, 'INVALID_PROGRAM');
  }

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
      }));
      await tx.insert(undoEntries).values(undoValues);
    }

    return instance.id;
  });

  // Fetch and return the full response after the transaction commits
  return getInstance(userId, instanceId);
}
