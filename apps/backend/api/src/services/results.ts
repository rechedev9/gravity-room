/**
 * Results service — record, delete, and undo workout results.
 * Every mutation pushes an undo entry for reversibility.
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { programInstances, workoutResults, undoEntries } from '@gzclp/database/schema';
import { ApiError } from '../middleware/error-handler';
import { getHistoricalProgramDefinition } from '../services/catalog';
import { SetLogEntrySchema } from '@gzclp/domain/schemas/instance';
import { MAX_TOTAL_WORKOUTS } from '@gzclp/domain/schemas/program-definition';
import type { SetLogEntry } from '@gzclp/domain/types';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { assertUserDataQuotas, lockUserForDataMutation } from './data-quotas';

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
  exerciseId: workoutResults.exerciseId,
  definitionVersion: workoutResults.definitionVersion,
} as const;

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

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

interface InstanceDefinitionContext {
  readonly templateId: string;
}

interface ResolvedSlotIdentity {
  readonly expectedSlots: number;
  readonly exerciseId: string;
  readonly definitionVersion: number;
}

async function getOwnedInstanceContext(
  userId: string,
  instanceId: string
): Promise<InstanceDefinitionContext> {
  const [instance] = await getDb()
    .select({ templateId: programInstances.templateId })
    .from(programInstances)
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .limit(1);
  if (!instance) throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
  return instance;
}

async function resolveHistoricalDefinition(programId: string): Promise<ProgramDefinition> {
  const result = await getHistoricalProgramDefinition(programId);
  if (result.status === 'found') return result.definition;
  throw new ApiError(
    409,
    'Program definition is unavailable; results cannot be validated safely',
    'PROGRAM_DEFINITION_UNAVAILABLE'
  );
}

function resolveSlotIdentity(
  definition: ProgramDefinition,
  workoutIndex: number,
  slotId: string
): ResolvedSlotIdentity {
  if (workoutIndex < 0 || workoutIndex >= definition.totalWorkouts) {
    throw new ApiError(400, `Invalid workoutIndex: ${workoutIndex}`, 'INVALID_DATA');
  }
  const day = definition.days[workoutIndex % definition.days.length];
  const slot = day?.slots.find((candidate) => candidate.id === slotId);
  if (!day || !slot) throw new ApiError(400, `Unknown slotId: ${slotId}`, 'INVALID_DATA');
  return {
    expectedSlots: day.slots.length,
    exerciseId: slot.exerciseId,
    definitionVersion: definition.version,
  };
}

async function lockOwnedInstance(tx: Tx, userId: string, instanceId: string): Promise<void> {
  const [instance] = await tx
    .select({ id: programInstances.id })
    .from(programInstances)
    .where(and(eq(programInstances.id, instanceId), eq(programInstances.userId, userId)))
    .for('update')
    .limit(1);
  if (!instance) throw new ApiError(404, 'Program instance not found', 'INSTANCE_NOT_FOUND');
}

/**
 * Manage completed_at lifecycle for a workout.
 * After any result mutation, checks if all slots are filled. If so, sets completed_at
 * on all rows. If the workout becomes incomplete, clears completed_at.
 *
 * Accepts `expectedSlots` directly from the fail-closed historical definition
 * resolution performed before the transaction.
 */
async function syncCompletedAt(
  tx: Tx,
  instanceId: string,
  workoutIndex: number,
  expectedSlots: number
): Promise<void> {
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
const MAX_RESULT_WORKOUT_INDEX = MAX_TOTAL_WORKOUTS - 1;
const MAX_SET_LOG_WEIGHT = 10_000;
const MAX_SET_LOG_ITEMS = 20;
const MAX_SLOT_ID_LENGTH = 50;

function assertWorkoutIndexInRange(workoutIndex: number): void {
  if (
    !Number.isInteger(workoutIndex) ||
    workoutIndex < 0 ||
    workoutIndex > MAX_RESULT_WORKOUT_INDEX
  ) {
    throw new ApiError(400, `Invalid workoutIndex: ${workoutIndex}`, 'INVALID_DATA');
  }
}

function assertSlotIdValid(slotId: string): void {
  if (slotId.length < 1 || slotId.length > MAX_SLOT_ID_LENGTH) {
    throw new ApiError(400, `Invalid slotId: ${slotId}`, 'INVALID_DATA');
  }
}

export async function recordResult(
  userId: string,
  instanceId: string,
  input: RecordResultInput
): Promise<WorkoutResultRow> {
  assertWorkoutIndexInRange(input.workoutIndex);
  assertSlotIdValid(input.slotId);
  if (input.amrapReps !== undefined && input.amrapReps > MAX_AMRAP_REPS) {
    throw new ApiError(400, `amrapReps cannot exceed ${MAX_AMRAP_REPS}`, 'INVALID_DATA');
  }
  if (input.rpe !== undefined && (input.rpe < 1 || input.rpe > 10)) {
    throw new ApiError(400, 'rpe must be between 1 and 10', 'INVALID_DATA');
  }
  if (input.setLogs !== undefined && input.setLogs.length > MAX_SET_LOG_ITEMS) {
    throw new ApiError(400, `setLogs cannot exceed ${MAX_SET_LOG_ITEMS} entries`, 'INVALID_DATA');
  }
  for (const setLog of input.setLogs ?? []) {
    if (!SetLogEntrySchema.safeParse(setLog).success) {
      throw new ApiError(400, 'Invalid setLogs entry', 'INVALID_DATA');
    }
    if (setLog.weight !== undefined && setLog.weight > MAX_SET_LOG_WEIGHT) {
      throw new ApiError(400, `setLogs.weight cannot exceed ${MAX_SET_LOG_WEIGHT}`, 'INVALID_DATA');
    }
  }

  const setLogsValue = input.setLogs ?? null;

  // Resolve before opening the transaction: the runtime pool has one connection,
  // so catalog hydration must not recursively borrow it while a tx is open.
  const context = await getOwnedInstanceContext(userId, instanceId);
  const definition = await resolveHistoricalDefinition(context.templateId);
  const identity = resolveSlotIdentity(definition, input.workoutIndex, input.slotId);

  const result = await getDb().transaction(async (tx) => {
    // Lock order is user -> instance everywhere. The user lock serializes account
    // quotas and analytics; the parent lock serializes result/undo semantics.
    await lockUserForDataMutation(tx, userId);
    await lockOwnedInstance(tx, userId, instanceId);

    // Capture existing state for undo (must happen before upsert).
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

    // An exact replay is a no-op. This provides compatible idempotency for
    // network retries without requiring existing clients to send a new key.
    if (
      existing &&
      existing.result === input.result &&
      existing.amrapReps === (input.amrapReps ?? null) &&
      existing.rpe === (input.rpe ?? null) &&
      existing.exerciseId === identity.exerciseId &&
      existing.definitionVersion === identity.definitionVersion &&
      jsonValuesEqual(existing.setLogs, setLogsValue)
    ) {
      return existing;
    }

    // Upsert — eliminates SELECT-then-INSERT/UPDATE race condition
    const [row] = await tx
      .insert(workoutResults)
      .values({
        instanceId,
        workoutIndex: input.workoutIndex,
        slotId: input.slotId,
        exerciseId: identity.exerciseId,
        definitionVersion: identity.definitionVersion,
        result: input.result,
        amrapReps: input.amrapReps ?? null,
        rpe: input.rpe ?? null,
        setLogs: setLogsValue,
      })
      .onConflictDoUpdate({
        target: [workoutResults.instanceId, workoutResults.workoutIndex, workoutResults.slotId],
        set: {
          exerciseId: identity.exerciseId,
          definitionVersion: identity.definitionVersion,
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
      previousExerciseId: existing?.exerciseId ?? null,
      previousDefinitionVersion: existing?.definitionVersion ?? null,
    });

    await trimUndoStack(tx, instanceId);

    await syncCompletedAt(tx, instanceId, input.workoutIndex, identity.expectedSlots);

    await touchInstanceTimestamp(tx, instanceId);
    await assertUserDataQuotas(tx, userId);

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
  assertWorkoutIndexInRange(workoutIndex);
  assertSlotIdValid(slotId);

  const context = await getOwnedInstanceContext(userId, instanceId);
  const definition = await resolveHistoricalDefinition(context.templateId);
  const identity = resolveSlotIdentity(definition, workoutIndex, slotId);

  await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    await lockOwnedInstance(tx, userId, instanceId);

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
      previousExerciseId: existing.exerciseId ?? identity.exerciseId,
      previousDefinitionVersion: existing.definitionVersion ?? identity.definitionVersion,
    });

    await trimUndoStack(tx, instanceId);

    await syncCompletedAt(tx, instanceId, workoutIndex, identity.expectedSlots);

    await touchInstanceTimestamp(tx, instanceId);
  });
}

// ---------------------------------------------------------------------------
// Undo last action
// ---------------------------------------------------------------------------

export async function undoLast(userId: string, instanceId: string): Promise<UndoEntryRow | null> {
  const context = await getOwnedInstanceContext(userId, instanceId);
  const definition = await resolveHistoricalDefinition(context.templateId);

  const entry = await getDb().transaction(async (tx) => {
    await lockUserForDataMutation(tx, userId);
    await lockOwnedInstance(tx, userId, instanceId);

    // The locked parent is the serialization boundary for the whole LIFO stack.
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
    const identity = resolveSlotIdentity(definition, found.workoutIndex, found.slotId);

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
          exerciseId: found.previousExerciseId ?? identity.exerciseId,
          definitionVersion: found.previousDefinitionVersion ?? identity.definitionVersion,
          result: found.previousResult,
          amrapReps: found.previousAmrapReps ?? null,
          rpe: found.previousRpe ?? null,
          setLogs: prevSetLogsValue,
        })
        .onConflictDoUpdate({
          target: [workoutResults.instanceId, workoutResults.workoutIndex, workoutResults.slotId],
          set: {
            exerciseId: found.previousExerciseId ?? identity.exerciseId,
            definitionVersion: found.previousDefinitionVersion ?? identity.definitionVersion,
            result: found.previousResult,
            amrapReps: found.previousAmrapReps ?? null,
            rpe: found.previousRpe ?? null,
            setLogs: prevSetLogsValue,
          },
        });
    }

    await syncCompletedAt(tx, instanceId, found.workoutIndex, identity.expectedSlots);

    await touchInstanceTimestamp(tx, instanceId);
    await assertUserDataQuotas(tx, userId);

    return found;
  });

  return entry;
}
