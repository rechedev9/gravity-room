/**
 * Destructive database lifecycle tests.
 *
 * These are intentionally opt-in and additionally refuse to run unless the
 * database name starts with `gravity_room_qa_`. Never point this suite at a
 * shared development or production database.
 */
process.env['LOG_LEVEL'] = 'silent';

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { eq, like } from 'drizzle-orm';
import {
  emailVerificationTokens,
  exercises,
  passwordResetTokens,
  programInstances,
  refreshTokens,
  users,
} from '@gzclp/database/schema';
import { closeDb, getDb } from '../db';
import { cleanupExpiredTokens } from './auth';
import { PURGE_BATCH_SIZE, purgeDeletedUsers } from './purge';

const databaseUrl = process.env['DATABASE_URL'];
const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasIsolatedDb =
  process.env['RUN_DB_MAINTENANCE_INTEGRATION'] === 'true' &&
  databaseName.startsWith('gravity_room_qa_');
const EMAIL_PREFIX = 'qa8-maintenance-';

function tokenHash(label: string): string {
  return createHash('sha256').update(label).digest('hex');
}

afterEach(async () => {
  if (!hasIsolatedDb) return;
  await getDb()
    .delete(users)
    .where(like(users.email, `${EMAIL_PREFIX}%`));
});

afterAll(async () => {
  await closeDb();
});

describe.skipIf(!hasIsolatedDb)('database maintenance lifecycle (integration)', () => {
  it('removes expired tokens from every authentication-token table', async () => {
    const [user] = await getDb()
      .insert(users)
      .values({ email: `${EMAIL_PREFIX}tokens@example.test` })
      .returning({ id: users.id });
    expect(user).toBeDefined();
    if (!user) return;

    const expired = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    await Promise.all([
      getDb()
        .insert(refreshTokens)
        .values([
          {
            userId: user.id,
            familyId: '00000000-0000-4000-8000-000000000001',
            tokenHash: tokenHash('expired-refresh'),
            expiresAt: expired,
          },
          {
            userId: user.id,
            familyId: '00000000-0000-4000-8000-000000000002',
            tokenHash: tokenHash('future-refresh'),
            expiresAt: future,
          },
        ]),
      getDb()
        .insert(passwordResetTokens)
        .values([
          { userId: user.id, tokenHash: tokenHash('expired-reset'), expiresAt: expired },
          { userId: user.id, tokenHash: tokenHash('future-reset'), expiresAt: future },
        ]),
      getDb()
        .insert(emailVerificationTokens)
        .values([
          {
            userId: user.id,
            tokenHash: tokenHash('expired-verification'),
            expiresAt: expired,
          },
          {
            userId: user.id,
            tokenHash: tokenHash('future-verification'),
            expiresAt: future,
          },
        ]),
    ]);

    await expect(cleanupExpiredTokens()).resolves.toBe(3);
    const [refresh, reset, verification] = await Promise.all([
      getDb().select().from(refreshTokens).where(eq(refreshTokens.userId, user.id)),
      getDb().select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id)),
      getDb()
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, user.id)),
    ]);
    expect(refresh).toHaveLength(1);
    expect(reset).toHaveLength(1);
    expect(verification).toHaveLength(1);
  });

  it('purges custom exercises with their deleted owner', async () => {
    const [user] = await getDb()
      .insert(users)
      .values({
        email: `${EMAIL_PREFIX}exercise-owner@example.test`,
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: users.id });
    expect(user).toBeDefined();
    if (!user) return;

    const exerciseId = 'qa8-private-custom-exercise';
    const systemExerciseId = 'qa8-system-exercise-with-legacy-owner';
    await getDb().insert(exercises).values({
      id: exerciseId,
      name: 'Private custom exercise',
      muscleGroupId: 'chest',
      isSystem: false,
      createdByUserId: user.id,
    });
    await getDb().insert(exercises).values({
      id: systemExerciseId,
      name: 'System exercise with legacy owner',
      muscleGroupId: 'chest',
      isSystem: true,
      createdByUserId: user.id,
    });

    try {
      await expect(purgeDeletedUsers()).resolves.toMatchObject({ purged: 1 });
      await expect(
        getDb().select().from(exercises).where(eq(exercises.id, exerciseId))
      ).resolves.toHaveLength(0);
      await expect(
        getDb().select().from(exercises).where(eq(exercises.id, systemExerciseId))
      ).resolves.toMatchObject([{ createdByUserId: null, isSystem: true }]);
    } finally {
      await getDb().delete(exercises).where(eq(exercises.id, systemExerciseId));
    }
  });

  it('bounds each purge invocation so a backlog can make incremental progress', async () => {
    const deletedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await getDb()
      .insert(users)
      .values(
        Array.from({ length: PURGE_BATCH_SIZE + 1 }, (_, index) => ({
          email: `${EMAIL_PREFIX}batch-${index}@example.test`,
          deletedAt,
        }))
      );

    await expect(purgeDeletedUsers()).resolves.toMatchObject({ purged: PURGE_BATCH_SIZE });
    await expect(purgeDeletedUsers()).resolves.toMatchObject({ purged: 1 });
  });

  it('rejects a program instance that references a missing definition', async () => {
    const [user] = await getDb()
      .insert(users)
      .values({ email: `${EMAIL_PREFIX}definition-fk@example.test` })
      .returning({ id: users.id });
    expect(user).toBeDefined();
    if (!user) return;

    await expect(
      getDb().insert(programInstances).values({
        userId: user.id,
        templateId: 'gzclp',
        definitionId: '00000000-0000-4000-8000-000000000000',
        name: 'Invalid definition reference',
        programConfig: {},
      })
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
});
