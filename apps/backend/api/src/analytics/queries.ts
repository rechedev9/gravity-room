/**
 * Drizzle data access for analytics pipelines.
 * Reads use stable exercise identity, a bounded newest-history window, and
 * deterministic ordering. `upsertInsight` writes `user_insights` with
 * `ON CONFLICT (user_id, insight_type, exercise_id) DO UPDATE`.
 */

import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { programInstances, userInsights, users, workoutResults } from '@gzclp/database/schema';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { WorkoutRecord } from './record';
import { prescribedWeights, weightKey } from './prescribed-weight';
import { MAX_ANALYTICS_RECORDS_PER_USER } from '../lib/data-limits';
import { getHistoricalProgramDefinition } from '../services/catalog';

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
    .innerJoin(users, eq(users.id, programInstances.userId))
    .where(and(inArray(programInstances.status, ['active', 'completed']), isNull(users.deletedAt)))
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
    .innerJoin(users, eq(users.id, programInstances.userId))
    .leftJoin(userInsights, eq(userInsights.userId, programInstances.userId))
    .where(and(inArray(programInstances.status, ['active', 'completed']), isNull(users.deletedAt)))
    .groupBy(programInstances.userId)
    .orderBy(
      sql`max(${userInsights.computedAt}) asc nulls first`,
      sql`${programInstances.userId}::text`
    )
    .limit(limit);
  return rows;
}

/** Run one user's bounded analytics under a transactional per-user lease. */
export async function withInsightTransaction<T>(
  userId: string,
  fn: (tx: Executor) => Promise<T>
): Promise<T> {
  return getDb().transaction(async (tx) => {
    // Same per-user row lock used by every quota-affecting data mutation. This
    // is both the analytics lease and the freshness boundary: no result/import/
    // delete can commit between the bounded history read and insight commit.
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .for('update')
      .limit(1);
    if (!user) throw new Error('Analytics user is no longer active');
    return fn(tx);
  });
}

/** True when the user's programs changed after their last insight snapshot. */
export async function hasStaleInsights(userId: string): Promise<boolean> {
  const lastComputedAt = sql`(
    select max(${userInsights.computedAt}) from ${userInsights}
    where ${userInsights.userId} = ${userId} and ${userInsights.insightType} = ${META_INSIGHT_TYPE}
  )`;
  const [row] = await getDb()
    .select({
      stale: sql<boolean>`count(*) > 0 and coalesce(max(${programInstances.updatedAt}) > ${lastComputedAt}, true)`,
    })
    .from(programInstances)
    .where(eq(programInstances.userId, userId));
  return row?.stale === true;
}

async function resolveInstanceDefinition(
  instance: { readonly templateId: string; readonly customDefinition: unknown },
  executor: Executor
): Promise<ProgramDefinition | null> {
  const custom = ProgramDefinitionSchema.safeParse(instance.customDefinition);
  if (custom.success) return custom.data;
  const stored = await getHistoricalProgramDefinition(instance.templateId, executor);
  return stored.status === 'found' ? stored.definition : null;
}

/**
 * The newest bounded workout-result window for a user. Only rows with a stable
 * versioned exercise identity participate; unresolved legacy rows are omitted
 * rather than unsafely grouped by reusable slot IDs. A row without a logged
 * weight takes the weight its program prescribed; rows with neither are omitted.
 */
export async function fetchWorkoutRecords(
  userId: string,
  executor: Executor = getDb()
): Promise<WorkoutRecord[]> {
  const rows = await executor
    .select({
      userId: sql<string>`${programInstances.userId}::text`,
      instanceId: sql<string>`${programInstances.id}::text`,
      programId: programInstances.templateId,
      workoutIndex: workoutResults.workoutIndex,
      slotId: workoutResults.slotId,
      exerciseId: sql<string>`${workoutResults.exerciseId}`,
      definitionVersion: sql<number>`${workoutResults.definitionVersion}`,
      loggedWeight: sql<number | null>`(${workoutResults.setLogs} -> 0 ->> 'weight')::float`,
      result: workoutResults.result,
      rpe: sql<number | null>`${workoutResults.rpe}::float`,
      amrapReps: workoutResults.amrapReps,
      setLogs: workoutResults.setLogs,
      recordedAt: sql<
        string | null
      >`coalesce(${workoutResults.completedAt}, ${workoutResults.createdAt})::text`,
    })
    .from(workoutResults)
    .innerJoin(programInstances, eq(programInstances.id, workoutResults.instanceId))
    .where(
      and(
        eq(programInstances.userId, userId),
        isNotNull(workoutResults.exerciseId),
        isNotNull(workoutResults.definitionVersion)
      )
    )
    .orderBy(
      desc(sql`coalesce(${workoutResults.completedAt}, ${workoutResults.createdAt})`),
      desc(workoutResults.id)
    )
    .limit(MAX_ANALYTICS_RECORDS_PER_USER);

  // Each result's tier and, for unlogged ones, its prescribed weight both come
  // from replaying the instance's own definition.
  const resultInstances = new Set(rows.map((row) => row.instanceId));
  const unweighted = new Set(
    rows.filter((row) => row.loggedWeight === null).map((row) => row.instanceId)
  );
  const prescribed = new Map<string, ReadonlyMap<string, number>>();
  const tiers = new Map<string, ReadonlyMap<string, string>>();
  if (resultInstances.size > 0) {
    const instances = await executor
      .select({
        id: sql<string>`${programInstances.id}::text`,
        templateId: programInstances.templateId,
        config: programInstances.programConfig,
        customDefinition: programInstances.customDefinition,
      })
      .from(programInstances)
      .where(eq(programInstances.userId, userId));
    for (const instance of instances) {
      if (!resultInstances.has(instance.id)) continue;
      const definition = await resolveInstanceDefinition(instance, executor);
      if (definition === null) continue;
      tiers.set(instance.id, slotTiers(definition));
      if (!unweighted.has(instance.id)) continue;
      prescribed.set(
        instance.id,
        prescribedWeights(
          rows.filter((row) => row.instanceId === instance.id),
          { definition, config: instance.config }
        )
      );
    }
  }

  // The query takes the newest bounded window; restore chronological order for
  // pipelines whose stable tie behavior relies on input order.
  const records: WorkoutRecord[] = [];
  for (const row of rows.reverse()) {
    // A slot whose tier cannot be resolved cannot be told apart from the other
    // tiers of its lift, so it is omitted like any other unresolved identity.
    const tier = tiers.get(row.instanceId)?.get(row.slotId);
    if (tier === undefined) continue;
    const weight = row.loggedWeight ?? prescribed.get(row.instanceId)?.get(weightKey(row));
    if (weight === undefined) continue;
    records.push({
      userId: row.userId,
      instanceId: row.instanceId,
      programId: row.programId,
      workoutIndex: row.workoutIndex,
      exerciseId: row.exerciseId,
      definitionVersion: Number(row.definitionVersion),
      tier,
      weight: Number(weight),
      result: row.result,
      rpe: row.rpe === null ? null : Number(row.rpe),
      amrapReps: row.amrapReps,
      recordedAt: row.recordedAt,
    });
  }
  return records;
}

function slotTiers(definition: ProgramDefinition): ReadonlyMap<string, string> {
  const tiers = new Map<string, string>();
  for (const day of definition.days) {
    for (const slot of day.slots) tiers.set(slot.id, slot.tier);
  }
  return tiers;
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

/**
 * Remove the previous user-facing snapshot before writing a freshly computed
 * one. This must run inside the same transaction as the replacement upserts:
 * pipelines legitimately stop emitting when history is removed or becomes
 * insufficient, and retaining those old rows would expose recommendations and
 * plateau alerts that are no longer supported by the user's data.
 */
export async function deleteComputedInsights(userId: string, executor: Executor): Promise<void> {
  await executor
    .delete(userInsights)
    .where(and(eq(userInsights.userId, userId), ne(userInsights.insightType, META_INSIGHT_TYPE)));
}
