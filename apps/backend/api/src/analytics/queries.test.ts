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
const { logger } = await import('../lib/logger');

function hydratedGzclp() {
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
  return gzclp.value;
}

interface FakeReads {
  readonly window: readonly unknown[];
  /** Every result of the user; defaults to the window. */
  readonly history?: readonly unknown[];
  readonly instances: readonly unknown[];
}

/** An executor answering the three reads of fetchWorkoutRecords in order. */
function fakeExecutor({ window, history = window, instances }: FakeReads) {
  const limit = vi.fn(() => window);
  const windowWhere = vi.fn<(condition: unknown) => unknown>(() => ({
    orderBy: () => ({ limit }),
  }));
  const historyWhere = vi.fn<(condition: unknown) => unknown>(() => history);
  const select = vi
    .fn()
    .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: windowWhere }) }) })
    .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: historyWhere }) }) })
    .mockReturnValueOnce({ from: () => ({ where: () => instances }) });
  return { executor: { select }, limit, windowWhere, historyWhere };
}

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
    mockGetHistoricalProgramDefinition.mockImplementation(() =>
      Promise.resolve({ status: 'found', definition: hydratedGzclp() })
    );
    const { executor, limit, windowWhere } = fakeExecutor({
      window: rows,
      instances: [{ id: 'i1', templateId: 'gzclp', config: {}, customDefinition: null }],
    });
    activeDb = executor;

    await expect(fetchWorkoutRecords('u1', activeDb as Parameters<typeof fetchWorkoutRecords>[1])).resolves.toMatchObject([
      { exerciseId: 'squat', definitionVersion: 1, weight: 80, tier: 't1' },
    ]);
    expect(limit).toHaveBeenCalledWith(MAX_ANALYTICS_RECORDS_PER_USER);
    expect(sqlText(windowWhere.mock.calls[0]?.[0])).toContain(
      '"workout_results"."exercise_id" is not null'
    );
    expect(sqlText(windowWhere.mock.calls[0]?.[0])).toContain(
      '"workout_results"."definition_version" is not null'
    );
  });

  it('gives an unlogged result its prescribed weight, read through the same executor', async () => {
    const gzclp = { ok: true as const, value: hydratedGzclp() };
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
    const { executor } = fakeExecutor({ window: resultRows, instances: instanceRows });
    activeDb = executor;

    await expect(
      fetchWorkoutRecords('u1', activeDb as Parameters<typeof fetchWorkoutRecords>[1])
    ).resolves.toMatchObject([{ instanceId: 'i1', weight: 60 }]);
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

  it('tells the tiers of one lift apart and drops a slot its definition does not know', async () => {
    mockGetHistoricalProgramDefinition.mockImplementation(() =>
      Promise.resolve({ status: 'found', definition: hydratedGzclp() })
    );
    const base = {
      userId: 'u1',
      instanceId: 'i1',
      programId: 'gzclp',
      exerciseId: 'squat',
      definitionVersion: 1,
      setLogs: null,
      result: 'success',
      rpe: null,
      amrapReps: null,
      recordedAt: '2026-01-01T00:00:00Z',
    };
    // Newest first, as the query returns them.
    const resultRows = [
      { ...base, workoutIndex: 2, slotId: 'd3-t2', loggedWeight: 60 },
      { ...base, workoutIndex: 0, slotId: 'd1-t1', loggedWeight: 80 },
      { ...base, workoutIndex: 1, slotId: 'not-a-slot', loggedWeight: 70 },
    ];
    activeDb = fakeExecutor({
      window: resultRows,
      instances: [{ id: 'i1', templateId: 'gzclp', config: {}, customDefinition: null }],
    }).executor;

    const records = await fetchWorkoutRecords('u1', activeDb as Parameters<typeof fetchWorkoutRecords>[1]);
    expect(records.map((r) => [r.workoutIndex, r.tier, r.weight])).toEqual([
      [0, 't1', 80],
      [2, 't2', 60],
    ]);
  });

  it('replays the whole instance history, including rows outside the insight window', async () => {
    mockGetHistoricalProgramDefinition.mockImplementation(() =>
      Promise.resolve({ status: 'found', definition: hydratedGzclp() })
    );
    const base = {
      userId: 'u1',
      instanceId: 'i1',
      programId: 'gzclp',
      definitionVersion: 1,
      loggedWeight: null,
      setLogs: null,
      rpe: null,
      amrapReps: null,
      recordedAt: '2026-01-01T00:00:00Z',
    };
    const squat = { ...base, slotId: 'd1-t1', exerciseId: 'squat' };
    const pulldown = { ...base, slotId: 'latpulldown-t3', exerciseId: 'latpulldown' };
    // Rows written before migration 0045 carry no exercise identity.
    const legacy = { exerciseId: null, definitionVersion: null };
    const history = [
      { ...squat, ...legacy, workoutIndex: 0, result: 'fail' },
      { ...pulldown, ...legacy, workoutIndex: 0, result: 'success' },
      { ...pulldown, ...legacy, workoutIndex: 4, result: 'success' },
      { ...squat, workoutIndex: 4, result: 'success' },
      { ...squat, workoutIndex: 8, result: 'success' },
      { ...pulldown, workoutIndex: 8, result: 'success' },
    ];
    // Newest first, identity-bearing rows only, as the window query returns them.
    const window = history.filter((row) => row.exerciseId !== null).reverse();
    const { executor, historyWhere } = fakeExecutor({
      window,
      history,
      instances: [
        {
          id: 'i1',
          templateId: 'gzclp',
          config: { squat: 60, latpulldown: 30 },
          customDefinition: null,
        },
      ],
    });
    activeDb = executor;

    const records = await fetchWorkoutRecords('u1', activeDb as Parameters<typeof fetchWorkoutRecords>[1]);

    // The early fail holds squat at 60 kg; three pulldown successes reach 35 kg.
    expect(records.map((r) => [r.exerciseId, r.workoutIndex, r.weight])).toEqual([
      ['squat', 4, 60],
      ['squat', 8, 65],
      ['latpulldown', 8, 35],
    ]);
    const historyFilter = sqlText(historyWhere.mock.calls[0]?.[0]);
    expect(historyFilter).not.toContain('exercise_id');
    expect(historyFilter).not.toContain('definition_version');
  });

  it('keys a series by the tiers of the whole history, not of the insight window', async () => {
    mockGetHistoricalProgramDefinition.mockImplementation(() =>
      Promise.resolve({ status: 'found', definition: hydratedGzclp() })
    );
    const base = {
      userId: 'u1',
      instanceId: 'i1',
      programId: 'gzclp',
      exerciseId: 'squat',
      definitionVersion: 1,
      setLogs: null,
      result: 'success',
      rpe: null,
      amrapReps: null,
      recordedAt: '2026-01-01T00:00:00Z',
    };
    const olderT2 = { ...base, workoutIndex: 2, slotId: 'd3-t2', loggedWeight: 60 };
    const recentT1 = { ...base, workoutIndex: 4, slotId: 'd1-t1', loggedWeight: 80 };
    // A row without identity takes no part in the decision.
    const legacy = { ...base, workoutIndex: 1, slotId: 'd2-t2', exerciseId: null };
    activeDb = fakeExecutor({
      window: [recentT1],
      history: [legacy, olderT2, recentT1],
      instances: [{ id: 'i1', templateId: 'gzclp', config: {}, customDefinition: null }],
    }).executor;

    const records = await fetchWorkoutRecords('u1', activeDb as Parameters<typeof fetchWorkoutRecords>[1]);
    expect(records.map((r) => r.seriesKey)).toEqual(['squat:t1']);
  });

  it('drops and reports a series whose key does not fit the column', async () => {
    mockGetHistoricalProgramDefinition.mockImplementation(() =>
      Promise.resolve({ status: 'found', definition: hydratedGzclp() })
    );
    const base = {
      userId: 'u1',
      instanceId: 'i1',
      programId: 'gzclp',
      definitionVersion: 1,
      setLogs: null,
      result: 'success',
      rpe: null,
      amrapReps: null,
      recordedAt: '2026-01-01T00:00:00Z',
    };
    const longId = 'x'.repeat(99);
    const window = [
      { ...base, exerciseId: 'bench', workoutIndex: 1, slotId: 'd2-t1', loggedWeight: 50 },
      { ...base, exerciseId: longId, workoutIndex: 2, slotId: 'd3-t2', loggedWeight: 60 },
      { ...base, exerciseId: longId, workoutIndex: 0, slotId: 'd1-t1', loggedWeight: 80 },
    ];
    activeDb = fakeExecutor({
      window,
      instances: [{ id: 'i1', templateId: 'gzclp', config: {}, customDefinition: null }],
    }).executor;
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const records = await fetchWorkoutRecords('u1', activeDb as Parameters<typeof fetchWorkoutRecords>[1]);

    expect(records.map((r) => r.seriesKey)).toEqual(['bench']);
    // One report per series: the long lift in T1 and in T2.
    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
