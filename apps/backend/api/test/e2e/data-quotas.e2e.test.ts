import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { and, count, eq, like } from 'drizzle-orm';
import { exercises, muscleGroups, programInstances, users } from '@gzclp/database/schema';
import { USER_DATA_LIMITS } from '../../src/lib/data-limits';
import { ApiError } from '../../src/middleware/error-handler';
import { assertUserDataQuotas, lockUserForDataMutation } from '../../src/services/data-quotas';
import { getTestDb, setupTestDb, teardownTestDb, truncateAllTables } from '../db-setup';

const FIXTURE_PREFIX = 'quota-e2e-';
const MUSCLE_GROUP_ID = `${FIXTURE_PREFIX}muscle`;

async function createUser(label: string): Promise<string> {
  const [user] = await getTestDb()
    .insert(users)
    .values({ email: `${FIXTURE_PREFIX}${label}@example.test` })
    .returning({ id: users.id });
  if (!user) throw new Error('Failed to create quota test user');
  return user.id;
}

beforeAll(async () => {
  await setupTestDb();
  await getTestDb()
    .insert(muscleGroups)
    .values({ id: MUSCLE_GROUP_ID, name: 'Quota E2E muscle' })
    .onConflictDoNothing();
});

afterEach(async () => {
  // exercises.created_by_user_id uses ON DELETE SET NULL, so remove owned
  // fixtures before truncating users to avoid leaving orphan test rows.
  await getTestDb()
    .delete(exercises)
    .where(like(exercises.id, `${FIXTURE_PREFIX}%`));
  await truncateAllTables();
});

afterAll(async () => {
  await getTestDb()
    .delete(exercises)
    .where(like(exercises.id, `${FIXTURE_PREFIX}%`));
  await getTestDb().delete(muscleGroups).where(eq(muscleGroups.id, MUSCLE_GROUP_ID));
  await teardownTestDb();
});

describe('account data quotas (database integration)', () => {
  it('accepts persisted usage exactly at the program-instance boundary', async () => {
    const userId = await createUser('at-limit');
    await getTestDb()
      .insert(programInstances)
      .values(
        Array.from({ length: USER_DATA_LIMITS.programInstances }, (_, index) => ({
          userId,
          templateId: 'quota-test-template',
          name: `Archived program ${index}`,
          programConfig: {},
          status: 'archived' as const,
        }))
      );

    await expect(
      getTestDb().transaction(async (tx) => {
        await lockUserForDataMutation(tx, userId);
        await assertUserDataQuotas(tx, userId);
      })
    ).resolves.toBeUndefined();
  });

  it('rejects one row over the boundary and rolls the whole transaction back', async () => {
    const userId = await createUser('rollback');

    await expect(
      getTestDb().transaction(async (tx) => {
        await lockUserForDataMutation(tx, userId);
        await tx.insert(programInstances).values(
          Array.from({ length: USER_DATA_LIMITS.programInstances + 1 }, (_, index) => ({
            userId,
            templateId: 'quota-test-template',
            name: `Rejected program ${index}`,
            programConfig: {},
            status: 'archived' as const,
          }))
        );
        await assertUserDataQuotas(tx, userId);
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DATA_QUOTA_EXCEEDED',
      details: { resource: 'programInstances', limit: USER_DATA_LIMITS.programInstances },
    });

    const [persisted] = await getTestDb()
      .select({ rows: count() })
      .from(programInstances)
      .where(eq(programInstances.userId, userId));
    expect(persisted?.rows).toBe(0);
  });

  it('serializes concurrent quota mutations so only one final slot commits', async () => {
    const userId = await createUser('concurrent');
    await getTestDb()
      .insert(exercises)
      .values(
        Array.from({ length: USER_DATA_LIMITS.customExercises - 1 }, (_, index) => ({
          id: `${FIXTURE_PREFIX}existing-${index}`,
          name: `Existing custom exercise ${index}`,
          muscleGroupId: MUSCLE_GROUP_ID,
          isSystem: false,
          createdByUserId: userId,
        }))
      );

    const createFinalSlot = (suffix: string) =>
      getTestDb().transaction(async (tx) => {
        await lockUserForDataMutation(tx, userId);
        await tx.insert(exercises).values({
          id: `${FIXTURE_PREFIX}concurrent-${suffix}`,
          name: `Concurrent custom exercise ${suffix}`,
          muscleGroupId: MUSCLE_GROUP_ID,
          isSystem: false,
          createdByUserId: userId,
        });
        await assertUserDataQuotas(tx, userId);
      });

    const outcomes = await Promise.allSettled([createFinalSlot('a'), createFinalSlot('b')]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected).toMatchObject({ status: 'rejected', reason: expect.any(ApiError) });
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toMatchObject({
        code: 'DATA_QUOTA_EXCEEDED',
        details: { resource: 'customExercises' },
      });
    }

    const [persisted] = await getTestDb()
      .select({ rows: count() })
      .from(exercises)
      .where(and(eq(exercises.createdByUserId, userId), eq(exercises.isSystem, false)));
    expect(persisted?.rows).toBe(USER_DATA_LIMITS.customExercises);
  });
});
