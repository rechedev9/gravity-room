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

/**
 * Per-user cursor marker insight type.
 *
 * computeUser upserts one row of this type for every user it processes (even
 * users with zero workout records) so that `fetchLeastRecentlyComputedUsers`,
 * which orders by max(computed_at), always advances the user's cursor. Without
 * it a record-less active user would never write a `computed_at` and would be
 * re-selected on every tick, starving users who actually have data. This marker
 * is internal bookkeeping only and is filtered out of `GET /api/insights`.
 */
export const META_INSIGHT_TYPE = '_meta';

/**
 * A Drizzle executor: either the pooled client or an open transaction handle.
 * Mirrors the pattern used in services/results.ts so insight writes can run
 * inside `withInsightTransaction` or standalone.
 */
type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
type Executor = Tx | ReturnType<typeof getDb>;

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
 * The least-recently-computed eligible users, capped at `limit`.
 *
 * Eligible users are those with an active/completed program instance (same set
 * as `fetchAllUsers`). They are ordered by the most recent `computed_at` across
 * their `user_insights` rows, ascending, with NULLS FIRST so users who have
 * never been computed are processed before stale ones. The trailing user_id
 * tie-breaker keeps the cursor deterministic across ticks. This drives the
 * bounded cron batch so a single tick never runs unbounded work.
 *
 * The max(computed_at) includes the per-user `_meta` marker row that computeUser
 * always upserts (see META_INSIGHT_TYPE), so even a user with zero workout
 * records advances out of the NULLS-FIRST head after one run and cannot starve
 * users who have data.
 */
export async function fetchLeastRecentlyComputedUsers(limit: number): Promise<UserRow[]> {
  const db = getDb();
  const rows = await db
    .select({ userId: sql<string>`${programInstances.userId}::text` })
    .from(programInstances)
    .leftJoin(userInsights, eq(userInsights.userId, programInstances.userId))
    .where(inArray(programInstances.status, ['active', 'completed']))
    .groupBy(programInstances.userId)
    .orderBy(
      sql`max(${userInsights.computedAt}) asc nulls first`,
      sql`${programInstances.userId}::text`
    )
    .limit(limit);
  return rows;
}

/**
 * Run `fn` inside a single database transaction, passing the transaction handle
 * so every insight upsert for one user commits atomically. A crashed tick rolls
 * back cleanly and is safe to replay because the upserts are idempotent.
 */
export async function withInsightTransaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => fn(tx));
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
  payload: unknown,
  executor: Executor = getDb()
): Promise<void> {
  await executor
    .insert(userInsights)
    .values({ userId, insightType, exerciseId, payload, computedAt: sql`now()` })
    .onConflictDoUpdate({
      target: [userInsights.userId, userInsights.insightType, userInsights.exerciseId],
      set: { payload, computedAt: sql`now()` },
    });
}
