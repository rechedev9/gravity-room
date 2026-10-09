process.env['LOG_LEVEL'] = 'silent';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { users } from '@gzclp/database/schema';
import { PROGRAM_TEMPLATE_DEFINITIONS } from '@gzclp/database/seeds/program-templates-seed';
import { CANONICAL_EXERCISES } from '@gzclp/database/seeds/exercises-seed';
import { hydrateProgramDefinition } from '../lib/hydrate-program';

let activeDb: unknown;

vi.mock('../db', () => ({
  getDb: () => activeDb,
}));

const mockGetHistoricalProgramDefinition = vi.fn<
  (programId: string, reader: unknown) => Promise<unknown>
>(() => Promise.resolve({ status: 'not_found' }));

vi.mock('../services/catalog', () => ({
  getHistoricalProgramDefinition: mockGetHistoricalProgramDefinition,
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
        slotId: 'd1-t1',
        loggedWeight: 80,
        setLogs: [{ reps: 5, weight: 80 }],
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
      { exerciseId: 'squat', definitionVersion: 1, weight: 80 },
    ]);
    expect(limit).toHaveBeenCalledWith(MAX_ANALYTICS_RECORDS_PER_USER);
    expect(sqlText(where.mock.calls[0]?.[0])).toContain(
      '"workout_results"."exercise_id" is not null'
    );
    expect(sqlText(where.mock.calls[0]?.[0])).toContain(
      '"workout_results"."definition_version" is not null'
    );
  });

  it('gives an unlogged result its prescribed weight, read through the same executor', async () => {
    const gzclp = hydrateProgramDefinition(
      {
        id: 'gzclp',
        name: 'GZCLP',
        description: '',
        author: '',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: PROGRAM_TEMPLATE_DEFINITIONS['gzclp'],
      },
      CANONICAL_EXERCISES.map((exercise) => ({ id: exercise.id, name: exercise.name }))
    );
    if (!gzclp.ok) throw new Error('GZCLP seed must hydrate');
    mockGetHistoricalProgramDefinition.mockImplementation((programId) =>
      Promise.resolve(
        programId === 'gzclp'
          ? { status: 'found', definition: gzclp.value }
          : { status: 'not_found' }
      )
    );

    const unlogged = {
      userId: 'u1',
      workoutIndex: 0,
      slotId: 'd1-t1',
      exerciseId: 'squat',
      definitionVersion: 1,
      loggedWeight: null,
      setLogs: null,
      result: 'success',
      rpe: null,
      amrapReps: null,
      recordedAt: '2026-01-01T00:00:00Z',
    };
    const resultRows = [
      { ...unlogged, instanceId: 'i1', programId: 'gzclp' },
      { ...unlogged, instanceId: 'i2', programId: 'retired' },
    ];
    const instanceRows = [
      { id: 'i1', templateId: 'gzclp', config: { squat: 60 }, customDefinition: null },
      { id: 'i2', templateId: 'retired', config: { squat: 60 }, customDefinition: null },
    ];
    const resultsChain = {
      from: () => ({
        innerJoin: () => ({ where: () => ({ orderBy: () => ({ limit: () => resultRows }) }) }),
      }),
    };
    const instancesChain = { from: () => ({ where: () => instanceRows }) };
    const select = vi.fn().mockReturnValueOnce(resultsChain).mockReturnValueOnce(instancesChain);
    const executor = { select };
    activeDb = executor;

    // A row whose definition is gone has no weight to analyse and is dropped.
    await expect(fetchWorkoutRecords('u1')).resolves.toMatchObject([
      { instanceId: 'i1', weight: 60 },
    ]);
    // The pool holds one connection: a lookup outside the executor would hang.
    expect(mockGetHistoricalProgramDefinition).toHaveBeenCalledWith('gzclp', executor);
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
