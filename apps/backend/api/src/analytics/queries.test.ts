process.env['LOG_LEVEL'] = 'silent';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { users } from '@gzclp/database/schema';

let activeDb: unknown;

vi.mock('../db', () => ({
  getDb: () => activeDb,
}));

const {
  fetchAllUsers,
  fetchLeastRecentlyComputedUsers,
  fetchWorkoutRecords,
  withInsightTransaction,
} = await import('./queries');
const { MAX_ANALYTICS_RECORDS_PER_USER } = await import('../lib/data-limits');

function sqlText(condition: unknown): string {
  if (
    condition === null ||
    typeof condition !== 'object' ||
    !('getSQL' in condition) ||
    typeof condition.getSQL !== 'function'
  ) {
    throw new Error('expected a Drizzle SQL condition');
  }
  return new PgDialect().sqlToQuery(condition.getSQL()).sql;
}

describe('analytics user selection', () => {
  beforeEach(() => {
    activeDb = undefined;
  });

  it('takes a per-user row lock before analytics work', async () => {
    const limit = vi.fn(() => Promise.resolve([{ id: 'u1' }]));
    const forUpdate = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ for: forUpdate }));
    const from = vi.fn(() => ({ where }));
    const tx = { select: vi.fn(() => ({ from })) };
    activeDb = {
      transaction: vi.fn(async (fn: (executor: typeof tx) => Promise<string>) => fn(tx)),
    };

    await expect(withInsightTransaction('u1', async () => 'done')).resolves.toBe('done');
    expect(forUpdate).toHaveBeenCalledWith('update');
  });

  it('excludes soft-deleted users from unbounded analytics runs', async () => {
    const rows = [{ userId: 'qa4-active-user' }];
    const orderBy = vi.fn(() => rows);
    const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
    const innerJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(
      () => ({ where })
    );
    const from = vi.fn(() => ({ innerJoin }));
    activeDb = { selectDistinct: vi.fn(() => ({ from })) };

    await expect(fetchAllUsers()).resolves.toEqual(rows);
    expect(innerJoin.mock.calls[0]?.[0]).toBe(users);
    expect(sqlText(where.mock.calls[0]?.[0])).toContain('"users"."deleted_at" is null');
  });

  it('bounds history and excludes unresolved exercise identities', async () => {
    const rows = [
      {
        userId: 'u1',
        instanceId: 'i1',
        programId: 'gzclp',
        workoutIndex: 0,
        exerciseId: 'squat',
        definitionVersion: 1,
        weight: 80,
        result: 'success',
        rpe: null,
        amrapReps: 5,
        recordedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const limit = vi.fn(() => rows);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn<(condition: unknown) => { orderBy: typeof orderBy }>(() => ({ orderBy }));
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    activeDb = { select: vi.fn(() => ({ from })) };

    await expect(fetchWorkoutRecords('u1')).resolves.toMatchObject([
      { exerciseId: 'squat', definitionVersion: 1 },
    ]);
    expect(limit).toHaveBeenCalledWith(MAX_ANALYTICS_RECORDS_PER_USER);
    expect(sqlText(where.mock.calls[0]?.[0])).toContain(
      '"workout_results"."exercise_id" is not null'
    );
    expect(sqlText(where.mock.calls[0]?.[0])).toContain(
      '"workout_results"."definition_version" is not null'
    );
  });

  it('excludes soft-deleted users from the fair bounded cron batch', async () => {
    const rows = [{ userId: 'qa4-active-user' }];
    const limit = vi.fn<(limit: number) => typeof rows>(() => rows);
    const orderBy = vi.fn(() => ({ limit }));
    const groupBy = vi.fn(() => ({ orderBy }));
    const where = vi.fn<(condition: unknown) => { groupBy: typeof groupBy }>(() => ({ groupBy }));
    const leftJoin = vi.fn<(table: unknown, condition: unknown) => { where: typeof where }>(() => ({
      where,
    }));
    const innerJoin = vi.fn<(table: unknown, condition: unknown) => { leftJoin: typeof leftJoin }>(
      () => ({ leftJoin })
    );
    const from = vi.fn(() => ({ innerJoin }));
    activeDb = { select: vi.fn(() => ({ from })) };

    await expect(fetchLeastRecentlyComputedUsers(4)).resolves.toEqual(rows);
    expect(innerJoin.mock.calls[0]?.[0]).toBe(users);
    expect(sqlText(where.mock.calls[0]?.[0])).toContain('"users"."deleted_at" is null');
    expect(limit).toHaveBeenCalledWith(4);
  });
});
