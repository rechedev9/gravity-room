import { and, count, eq, sql } from 'drizzle-orm';
import {
  exercises,
  programDefinitions,
  programInstances,
  undoEntries,
  users,
  workoutResults,
} from '@gzclp/database/schema';
import { getDb } from '../db';
import { USER_DATA_LIMITS } from '../lib/data-limits';
import { ApiError } from '../middleware/error-handler';

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

export interface UserDataUsage {
  readonly programInstances: number;
  readonly workoutResults: number;
  readonly undoEntries: number;
  readonly customExercises: number;
  readonly jsonBytes: number;
}

/**
 * Every quota-affecting transaction takes this lock first. It serializes quota
 * checks across independent instances and also gives analytics a stable user
 * snapshot when it takes the same lock.
 */
export async function lockUserForDataMutation(tx: Tx, userId: string): Promise<void> {
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for('update')
    .limit(1);

  if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
}

export function findExceededQuota(usage: UserDataUsage): keyof typeof USER_DATA_LIMITS | undefined {
  const keys: ReadonlyArray<keyof typeof USER_DATA_LIMITS> = [
    'programInstances',
    'workoutResults',
    'undoEntries',
    'customExercises',
    'jsonBytes',
  ];
  return keys.find((key) => usage[key] > USER_DATA_LIMITS[key]);
}

/** Read final transaction-visible usage. Call only after locking the user row. */
export async function getUserDataUsage(tx: Tx, userId: string): Promise<UserDataUsage> {
  const [instancesResult, resultsResult, undoResult, exerciseResult, definitionsResult] =
    await Promise.all([
      tx
        .select({
          rows: sql<number>`count(*)::int`,
          jsonBytes: sql<number>`coalesce(sum(
            octet_length(${programInstances.programConfig}::text) +
            octet_length(coalesce(${programInstances.metadata}::text, '')) +
            octet_length(coalesce(${programInstances.customDefinition}::text, ''))
          ), 0)::int`,
        })
        .from(programInstances)
        .where(eq(programInstances.userId, userId)),
      tx
        .select({
          rows: sql<number>`count(*)::int`,
          jsonBytes: sql<number>`coalesce(sum(octet_length(coalesce(${workoutResults.setLogs}::text, ''))), 0)::int`,
        })
        .from(workoutResults)
        .innerJoin(programInstances, eq(programInstances.id, workoutResults.instanceId))
        .where(eq(programInstances.userId, userId)),
      tx
        .select({
          rows: sql<number>`count(*)::int`,
          jsonBytes: sql<number>`coalesce(sum(octet_length(coalesce(${undoEntries.previousSetLogs}::text, ''))), 0)::int`,
        })
        .from(undoEntries)
        .innerJoin(programInstances, eq(programInstances.id, undoEntries.instanceId))
        .where(eq(programInstances.userId, userId)),
      tx
        .select({ rows: count() })
        .from(exercises)
        .where(and(eq(exercises.createdByUserId, userId), eq(exercises.isSystem, false))),
      tx
        .select({
          jsonBytes: sql<number>`coalesce(sum(octet_length(${programDefinitions.definition}::text)), 0)::int`,
        })
        .from(programDefinitions)
        .where(eq(programDefinitions.userId, userId)),
    ]);

  const instances = instancesResult[0];
  const results = resultsResult[0];
  const undo = undoResult[0];
  const customExercises = exerciseResult[0];
  const definitions = definitionsResult[0];

  return {
    programInstances: instances?.rows ?? 0,
    workoutResults: results?.rows ?? 0,
    undoEntries: undo?.rows ?? 0,
    customExercises: customExercises?.rows ?? 0,
    jsonBytes:
      (instances?.jsonBytes ?? 0) +
      (results?.jsonBytes ?? 0) +
      (undo?.jsonBytes ?? 0) +
      (definitions?.jsonBytes ?? 0),
  };
}

/** Check final state so an over-quota mutation rolls back atomically. */
export async function assertUserDataQuotas(tx: Tx, userId: string): Promise<void> {
  const usage = await getUserDataUsage(tx, userId);
  const exceeded = findExceededQuota(usage);
  if (!exceeded) return;

  throw new ApiError(409, 'Account data quota exceeded', 'DATA_QUOTA_EXCEEDED', {
    details: {
      resource: exceeded,
      limit: USER_DATA_LIMITS[exceeded],
    },
  });
}
