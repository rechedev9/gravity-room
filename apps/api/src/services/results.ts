/**
 * Results service — record, delete, and undo workout results.
 * Every mutation pushes an undo entry for reversibility.
 */
import { eq, and, desc, lte } from 'drizzle-orm';
import { getDb } from '../db';
import { programInstances, workoutResults, undoEntries } from '../db/schema';
import { ApiError } from '../middleware/error-handler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WorkoutResultRow = typeof workoutResults.$inferSelect;
type UndoEntryRow = typeof undoEntries.$inferSelect;

export interface RecordResultInput {
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result: 'success' | 'fail';
  readonly amrapReps?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_UNDO_STACK = 50;

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

async function trimUndoStack(tx: Tx, instanceId: string): Promise<void> {
  const [overflow] = await tx
    .select({ id: undoEntries.id })
    .from(undoEntries)
    .where(eq(undoEntries.instanceId, instanceId))
    .orderBy(desc(undoEntries.id))
    .offset(MAX_UNDO_STACK)
    .limit(1);

  if (overflow) {
    await tx
      .delete(undoEntries)
      .where(and(eq(undoEntries.instanceId, instanceId), lte(undoEntries.id, overflow.id)));
  }
}

async function verifyInstanceOwnership(userId: string, instanceId: string): Promise<void> {
  const [instance] = await getDb()
    .select({ id: programInstances.id })
    .from(programInstances)
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .limit(1);

  if (!instance) {
    throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
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
  await verifyInstanceOwnership(userId, instanceId);

  return await getDb().transaction(async (tx) => {
    // Capture existing state for undo (must happen before upsert)
    const [existing] = await tx
      .select()
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
    const [result] = await tx
      .insert(workoutResults)
      .values({
        instanceId,
        workoutIndex: input.workoutIndex,
        slotId: input.slotId,
        result: input.result,
        amrapReps: input.amrapReps ?? null,
      })
      .onConflictDoUpdate({
        target: [workoutResults.instanceId, workoutResults.workoutIndex, workoutResults.slotId],
        set: { result: input.result, amrapReps: input.amrapReps ?? null },
      })
      .returning();

    if (!result) {
      throw new ApiError(500, 'Failed to record result', 'INSERT_FAILED');
    }

    // Push undo entry — captures both prevResult and prevAmrapReps
    await tx.insert(undoEntries).values({
      instanceId,
      workoutIndex: input.workoutIndex,
      slotId: input.slotId,
      prevResult: existing?.result ?? null,
      prevAmrapReps: existing?.amrapReps ?? null,
    });

    // Update instance timestamp
    await tx
      .update(programInstances)
      .set({ updatedAt: new Date() })
      .where(eq(programInstances.id, instanceId));

    await trimUndoStack(tx, instanceId);

    return result;
  });
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
  await verifyInstanceOwnership(userId, instanceId);

  await getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(workoutResults)
      .where(
        and(
          eq(workoutResults.instanceId, instanceId),
          eq(workoutResults.workoutIndex, workoutIndex),
          eq(workoutResults.slotId, slotId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'Result not found', 'RESULT_NOT_FOUND');
    }

    // Push undo entry before deleting (captures amrapReps too)
    await tx.insert(undoEntries).values({
      instanceId,
      workoutIndex,
      slotId,
      prevResult: existing.result,
      prevAmrapReps: existing.amrapReps ?? null,
    });

    await tx.delete(workoutResults).where(eq(workoutResults.id, existing.id));

    await tx
      .update(programInstances)
      .set({ updatedAt: new Date() })
      .where(eq(programInstances.id, instanceId));

    await trimUndoStack(tx, instanceId);
  });
}

// ---------------------------------------------------------------------------
// Undo last action
// ---------------------------------------------------------------------------

export async function undoLast(userId: string, instanceId: string): Promise<UndoEntryRow | null> {
  await verifyInstanceOwnership(userId, instanceId);

  return await getDb().transaction(async (tx) => {
    // Pop the most recent undo entry (LIFO — highest id)
    const [entry] = await tx
      .select()
      .from(undoEntries)
      .where(eq(undoEntries.instanceId, instanceId))
      .orderBy(desc(undoEntries.id))
      .limit(1);

    if (!entry) {
      return null; // Nothing to undo
    }

    // Remove the undo entry (consumed)
    await tx.delete(undoEntries).where(eq(undoEntries.id, entry.id));

    if (entry.prevResult === null) {
      // Previous state was "no result" — delete the current result
      await tx
        .delete(workoutResults)
        .where(
          and(
            eq(workoutResults.instanceId, instanceId),
            eq(workoutResults.workoutIndex, entry.workoutIndex),
            eq(workoutResults.slotId, entry.slotId)
          )
        );
    } else {
      // Previous state was a result — restore it with amrapReps via upsert
      await tx
        .insert(workoutResults)
        .values({
          instanceId,
          workoutIndex: entry.workoutIndex,
          slotId: entry.slotId,
          result: entry.prevResult,
          amrapReps: entry.prevAmrapReps ?? null,
        })
        .onConflictDoUpdate({
          target: [workoutResults.instanceId, workoutResults.workoutIndex, workoutResults.slotId],
          set: { result: entry.prevResult, amrapReps: entry.prevAmrapReps ?? null },
        });
    }

    await tx
      .update(programInstances)
      .set({ updatedAt: new Date() })
      .where(eq(programInstances.id, instanceId));

    return entry;
  });
}
