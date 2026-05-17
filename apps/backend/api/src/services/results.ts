/**
 * Results service — record, delete, and undo workout results.
 * Every mutation pushes an undo entry for reversibility.
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { programInstances, workoutResults, undoEntries } from '@gzclp/database/schema';
import { ApiError } from '../middleware/error-handler';
import { getProgramDefinition } from '../services/catalog';
import type { SetLogEntry } from '@gzclp/domain/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkoutResultRow = typeof workoutResults.$inferSelect;
type UndoEntryRow = typeof undoEntries.$inferSelect;

interface RecordResultInput {
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result: 'success' | 'fail';
  readonly amrapReps?: number;
  readonly rpe?: number;
  readonly setLogs?: readonly SetLogEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_UNDO_STACK = 50;

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

// Columns captured into undo_entries when a result is created/updated/deleted.
const undoSnapshotFields = {
  result: workoutResults.result,
  amrapReps: workoutResults.amrapReps,
  rpe: workoutResults.rpe,
  setLogs: workoutResults.setLogs,
} as const;

// The `updated_at` value is overridden by the BEFORE UPDATE trigger; we still
// need an UPDATE statement to fire it.
async function touchInstanceTimestamp(tx: Tx, instanceId: string): Promise<void> {
  await tx
    .update(programInstances)
    .set({ updatedAt: new Date() })
    .where(eq(programInstances.id, instanceId));
}

async function trimUndoStack(tx: Tx, instanceId: string): Promise<void> {
  // Single statement: delete any entry beyond the MAX_UNDO_STACK most recent.
  // Subquery returns the ids to evict; OFFSET skips the keepers.
  await tx.execute(sql`
    DELETE FROM undo_entries
    WHERE instance_id = ${instanceId}
      AND id IN (
        SELECT id FROM undo_entries
        WHERE instance_id = ${instanceId}
        ORDER BY id DESC
        OFFSET ${sql.raw(String(MAX_UNDO_STACK))}
      )
  `);
}

async function verifyInstanceOwnership(
  db: Tx | ReturnType<typeof getDb>,
  userId: string,
  instanceId: string
): Promise<string> {
  const [instance] = await db
    .select({ id: programInstances.id, templateId: programInstances.templateId })
    .from(programInstances)
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .limit(1);

  if (!instance) {
    throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  }

  return instance.templateId;
}

/**
 * Get the expected number of slots for a given workout index from the program definition.
 * Returns undefined if the definition cannot be resolved (completed_at will be skipped).
 */
async function getExpectedSlotCount(
  programId: string,
  workoutIndex: number
): Promise<number | undefined> {
  const defResult = await getProgramDefinition(programId);
  if (defResult.status !== 'found') return undefined;

  const def = defResult.definition;
  const cycleLength = def.days.length;
  const day = def.days[workoutIndex % cycleLength];
  return day.slots.length;
}

/**
 * Manage completed_at lifecycle for a workout.
 * After any result mutation, checks if all slots are filled. If so, sets completed_at
 * on all rows. If the workout becomes incomplete, clears completed_at.
 *
 * Accepts `expectedSlots` directly — the caller resolves the slot count
 * via `getExpectedSlotCount` before calling this function.
 */
async function syncCompletedAt(
  tx: Tx,
  instanceId: string,
  workoutIndex: number,
  expectedSlots: number | undefined
): Promise<void> {
  if (expectedSlots === undefined) return;

  const resultRows = await tx
    .select({ id: workoutResults.id, completedAt: workoutResults.completedAt })
    .from(workoutResults)
    .where(
      and(eq(workoutResults.instanceId, instanceId), eq(workoutResults.workoutIndex, workoutIndex))
    );

  const isComplete = resultRows.length >= expectedSlots;

  if (isComplete) {
    // Only set completed_at if not already set (idempotent)
    const needsUpdate = resultRows.some((r) => r.completedAt === null);
    if (needsUpdate) {
      await tx
        .update(workoutResults)
        .set({ completedAt: new Date() })
        .where(
          and(
            eq(workoutResults.instanceId, instanceId),
            eq(workoutResults.workoutIndex, workoutIndex)
          )
        );
    }
  } else {
    // Workout is incomplete — clear completed_at on remaining rows
    const needsClear = resultRows.some((r) => r.completedAt !== null);
    if (needsClear) {
      await tx
        .update(workoutResults)
        .set({ completedAt: null })
        .where(
          and(
            eq(workoutResults.instanceId, instanceId),
            eq(workoutResults.workoutIndex, workoutIndex)
          )
        );
    }
  }
}

// ---------------------------------------------------------------------------
// Record a workout result
// ---------------------------------------------------------------------------

const MAX_AMRAP_REPS = 99;

export async function recordResult(
  userId: string,
  instanceId: string,
  input: RecordResultInput
): Promise<WorkoutResultRow> {
  if (input.amrapReps !== undefined && input.amrapReps > MAX_AMRAP_REPS) {
    throw new ApiError(400, `amrapReps cannot exceed ${MAX_AMRAP_REPS}`, 'INVALID_DATA');
  }
  if (input.rpe !== undefined && (input.rpe < 1 || input.rpe > 10)) {
    throw new ApiError(400, 'rpe must be between 1 and 10', 'INVALID_DATA');
  }

  const setLogsValue = input.setLogs ?? null;

  // Resolve template + expected slot count BEFORE opening the tx — neither
  // changes during the tx and `getProgramDefinition` does its own DB read.
  const programId = await verifyInstanceOwnership(getDb(), userId, instanceId);
  const expectedSlots = await getExpectedSlotCount(programId, input.workoutIndex);

  const result = await getDb().transaction(async (tx) => {
    // Capture existing state for undo (must happen before upsert)
    const [existing] = await tx
      .select(undoSnapshotFields)
      .from(workoutResults)
      .where(
        and(
          eq(workoutResults.instanceId, instanceId),
          eq(workoutResults.workoutIndex, input.workoutIndex),
          eq(workoutResults.slotId, input.slotId)
        )
      )
      .limit(1);

    // Upsert — eliminates SELECT-then-INSERT/UPDATE race condition
    const [row] = await tx
      .insert(workoutResults)
      .values({
        instanceId,
        workoutIndex: input.workoutIndex,
        slotId: input.slotId,
        result: input.result,
        amrapReps: input.amrapReps ?? null,
        rpe: input.rpe ?? null,
        setLogs: setLogsValue,
      })
      .onConflictDoUpdate({
        target: [workoutResults.instanceId, workoutResults.workoutIndex, workoutResults.slotId],
        set: {
          result: input.result,
          amrapReps: input.amrapReps ?? null,
          rpe: input.rpe ?? null,
          setLogs: setLogsValue,
        },
      })
      .returning();

    if (!row) {
      throw new ApiError(500, 'Failed to record result', 'INSERT_FAILED');
    }

    // Push undo entry — captures previousResult, previousAmrapReps, previousRpe, and previousSetLogs
    await tx.insert(undoEntries).values({
      instanceId,
      workoutIndex: input.workoutIndex,
      slotId: input.slotId,
      previousResult: existing?.result ?? null,
      previousAmrapReps: existing?.amrapReps ?? null,
      previousRpe: existing?.rpe ?? null,
      previousSetLogs: existing?.setLogs ?? null,
    });

    await trimUndoStack(tx, instanceId);

    await syncCompletedAt(tx, instanceId, input.workoutIndex, expectedSlots);

    await touchInstanceTimestamp(tx, instanceId);

    return row;
  });

  return result;
}

// ---------------------------------------------------------------------------
// Delete a workout result
// ---------------------------------------------------------------------------

export async function deleteResult(
  userId: string,
  instanceId: string,
  workoutIndex: number,
  slotId: string
): Promise<void> {
  // Resolve template + expected slot count BEFORE opening the tx.
  const programId = await verifyInstanceOwnership(getDb(), userId, instanceId);
  const expectedSlots = await getExpectedSlotCount(programId, workoutIndex);

  await getDb().transaction(async (tx) => {
    const [existing] = await tx
      .delete(workoutResults)
      .where(
        and(
          eq(workoutResults.instanceId, instanceId),
          eq(workoutResults.workoutIndex, workoutIndex),
          eq(workoutResults.slotId, slotId)
        )
      )
      .returning(undoSnapshotFields);

    if (!existing) {
      throw new ApiError(404, 'Result not found', 'RESULT_NOT_FOUND');
    }

    await tx.insert(undoEntries).values({
      instanceId,
      workoutIndex,
      slotId,
      previousResult: existing.result,
      previousAmrapReps: existing.amrapReps ?? null,
      previousRpe: existing.rpe ?? null,
      previousSetLogs: existing.setLogs ?? null,
    });

    await trimUndoStack(tx, instanceId);

    await syncCompletedAt(tx, instanceId, workoutIndex, expectedSlots);

    await touchInstanceTimestamp(tx, instanceId);
  });
}

// ---------------------------------------------------------------------------
// Undo last action
// ---------------------------------------------------------------------------

export async function undoLast(userId: string, instanceId: string): Promise<UndoEntryRow | null> {
  // Ownership + template resolution + peek at the top-of-stack workoutIndex
  // happen BEFORE the tx — none of these change frequently and the slot count
  // is keyed by the program definition + workoutIndex pair. Even if a
  // concurrent op pops a different undo entry inside the tx, `syncCompletedAt`
  // is keyed by workoutIndex and remains correct.
  const programId = await verifyInstanceOwnership(getDb(), userId, instanceId);
  const [peek] = await getDb()
    .select({ workoutIndex: undoEntries.workoutIndex })
    .from(undoEntries)
    .where(eq(undoEntries.instanceId, instanceId))
    .orderBy(desc(undoEntries.id))
    .limit(1);
  if (!peek) return null;
  const expectedSlots = await getExpectedSlotCount(programId, peek.workoutIndex);

  const entry = await getDb().transaction(async (tx) => {
    // Pop the most recent undo entry (LIFO — highest id)
    const [found] = await tx
      .select()
      .from(undoEntries)
      .where(eq(undoEntries.instanceId, instanceId))
      .orderBy(desc(undoEntries.id))
      .limit(1);

    if (!found) {
      return null; // Nothing to undo
    }

    // Remove the undo entry (consumed)
    await tx.delete(undoEntries).where(eq(undoEntries.id, found.id));

    const prevSetLogsValue = found.previousSetLogs ?? null;

    if (found.previousResult === null) {
      // Previous state was "no result" — delete the current result
      await tx
        .delete(workoutResults)
        .where(
          and(
            eq(workoutResults.instanceId, instanceId),
            eq(workoutResults.workoutIndex, found.workoutIndex),
            eq(workoutResults.slotId, found.slotId)
          )
        );
    } else {
      // Previous state was a result — restore it with amrapReps, rpe, and setLogs via upsert
      await tx
        .insert(workoutResults)
        .values({
          instanceId,
          workoutIndex: found.workoutIndex,
          slotId: found.slotId,
          result: found.previousResult,
          amrapReps: found.previousAmrapReps ?? null,
          rpe: found.previousRpe ?? null,
          setLogs: prevSetLogsValue,
        })
        .onConflictDoUpdate({
          target: [workoutResults.instanceId, workoutResults.workoutIndex, workoutResults.slotId],
          set: {
            result: found.previousResult,
            amrapReps: found.previousAmrapReps ?? null,
            rpe: found.previousRpe ?? null,
            setLogs: prevSetLogsValue,
          },
        });
    }

    // expectedSlots was resolved pre-tx for peek.workoutIndex; if the popped
    // entry's workoutIndex differs (concurrent undo), re-resolve to stay correct.
    const slots =
      found.workoutIndex === peek.workoutIndex
        ? expectedSlots
        : await getExpectedSlotCount(programId, found.workoutIndex);
    await syncCompletedAt(tx, instanceId, found.workoutIndex, slots);

    await touchInstanceTimestamp(tx, instanceId);

    return found;
  });

  return entry;
}
