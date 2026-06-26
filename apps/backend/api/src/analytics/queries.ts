/**
 * Drizzle data access for the analytics pipelines.
 *
 * Ports apps/backend/analytics/queries.py to the API package's shared Drizzle
 * client. The SQL is reproduced faithfully, including the
 * `set_logs -> 0 ->> 'weight'` JSON extraction, the `program_instances` join,
 * the status filter, and the deterministic ordering. `upsertInsight` writes the
 * `user_insights` table with the same `ON CONFLICT (user_id, insight_type,
 * exercise_id) DO UPDATE` semantics the Python service uses.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { programInstances, userInsights, workoutResults } from '../db/schema';
import type { WorkoutRecord } from './record';

export interface UserRow {
  readonly userId: string;
}

/** All user IDs with at least one active/completed program instance. */
export async function fetchAllUsers(): Promise<UserRow[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ userId: sql<string>`${programInstances.userId}::text` })
    .from(programInstances)
    .where(inArray(programInstances.status, ['active', 'completed']))
    // Order by the same text expression so DISTINCT + ORDER BY agree; uuid text
    // ordering matches uuid ordering, so this preserves queries.py's sequence.
    .orderBy(sql`${programInstances.userId}::text`);
  return rows;
}

/**
 * All workout slot results for a user, oldest first, with the first set's
 * weight extracted from `set_logs`. Mirrors queries.py:fetch_workout_records.
 */
export async function fetchWorkoutRecords(userId: string): Promise<WorkoutRecord[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: sql<string>`${programInstances.userId}::text`,
      instanceId: sql<string>`${programInstances.id}::text`,
      programId: programInstances.templateId,
      workoutIndex: workoutResults.workoutIndex,
      slotId: workoutResults.slotId,
      weight: sql<number>`(${workoutResults.setLogs} -> 0 ->> 'weight')::float`,
      result: sql<string>`${workoutResults.result}::text`,
      rpe: sql<number | null>`${workoutResults.rpe}::float`,
      amrapReps: workoutResults.amrapReps,
      recordedAt: sql<
        string | null
      >`coalesce(${workoutResults.completedAt}, ${workoutResults.createdAt})::text`,
    })
    .from(workoutResults)
    .innerJoin(programInstances, eq(programInstances.id, workoutResults.instanceId))
    .where(
      and(
        eq(programInstances.userId, userId),
        sql`(${workoutResults.setLogs} -> 0 ->> 'weight') is not null`
      )
    )
    .orderBy(programInstances.createdAt, workoutResults.workoutIndex, workoutResults.slotId);

  return rows.map((row) => ({
    userId: row.userId,
    instanceId: row.instanceId,
    programId: row.programId,
    workoutIndex: row.workoutIndex,
    slotId: row.slotId,
    weight: Number(row.weight),
    result: row.result,
    rpe: row.rpe === null ? null : Number(row.rpe),
    amrapReps: row.amrapReps,
    recordedAt: row.recordedAt,
  }));
}

/**
 * Upsert a single insight row, matching queries.py:upsert_insight:
 *   INSERT ... VALUES (..., NOW())
 *   ON CONFLICT (user_id, insight_type, exercise_id)
 *   DO UPDATE SET payload = EXCLUDED.payload, computed_at = NOW()
 */
export async function upsertInsight(
  userId: string,
  insightType: string,
  exerciseId: string | null,
  payload: unknown
): Promise<void> {
  const db = getDb();
  await db
    .insert(userInsights)
    .values({ userId, insightType, exerciseId, payload, computedAt: sql`now()` })
    .onConflictDoUpdate({
      target: [userInsights.userId, userInsights.insightType, userInsights.exerciseId],
      set: { payload, computedAt: sql`now()` },
    });
}
