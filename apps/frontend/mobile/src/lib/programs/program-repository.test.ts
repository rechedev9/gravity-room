/// <reference types="node" />

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { CatalogEntry, GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';
import type { SQLiteBindValue } from 'expo-sqlite';

import { isAuthorizedSessionCurrent, type AuthorizedSession } from '../auth/session';
import type { DatabaseClient } from '../db/expo-sqlite-adapter';
import {
  MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL,
  MOBILE_V2_RECONCILIATION_EXPECTATIONS_SQL,
  MOBILE_V2_SNAPSHOT_METADATA_TABLE_SQL,
  QUEUED_MUTATIONS_TABLE_SQL,
} from '../db/schema';

let mockDatabaseClient: DatabaseClient;

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
  getDatabase: jest.fn(() => mockDatabaseClient),
}));

jest.mock('../auth/session', () => {
  const actual = jest.requireActual<typeof import('../auth/session')>('../auth/session');
  const isAuthorizedSessionCurrent = jest.fn((session: AuthorizedSession) => {
    void session;
    return true;
  });
  return {
    ...actual,
    isAuthorizedSessionCurrent,
    assertAuthorizedSessionCurrent: jest.fn((session: AuthorizedSession) => {
      if (!isAuthorizedSessionCurrent(session)) {
        throw new actual.ObsoleteAuthorizedSessionError();
      }
    }),
  };
});

import {
  cacheCreatedProgram as cacheCreatedProgramRepository,
  cacheManagedProgram,
  clearProgramDeleteReconciliation,
  commitProgramSummariesRefresh,
  deleteLocalProgramData,
  listCachedCatalog,
  listProgramSummaries,
  readProgramCatalogSnapshot,
  readProgramLibrarySnapshot,
  readPendingCreateReconciliation,
  readPendingDeleteReconciliations,
  readPendingManageReconciliations,
  recordProgramReconciliation,
  replaceCachedCatalog,
  replaceProgramSummaries,
  resolveProgramReconciliationWithRemoteDetail,
} from './program-repository';
import {
  abandonProgramRefreshLease,
  advanceProgramMutationGenerations,
  advanceProgramRefreshGeneration,
  captureProgramRefreshLease,
  getNewerProgramRefreshLeaseSettlement,
  isProgramRefreshLeaseCurrent,
  withProgramRefreshCommitBarrier,
} from './program-refresh-generation';
import {
  commitProgramDetailRefresh,
  commitProgramDefinitionRefresh,
  getProgramDefinition,
  getProgramDetail,
  upsertProgramDetail,
} from '../tracker/program-detail-repository';
import { readTrackerProgramId } from '../tracker/tracker-selection-storage';

interface MemoryDatabase {
  readonly client: DatabaseClient;
  readonly sqlite: DatabaseSync;
  readonly setFailingProgramId: (programId: string | null) => void;
  readonly setAfterWrite: (callback: (() => void | Promise<void>) | null) => void;
  readonly setBeforeCommit: (callback: (() => Promise<void>) | null) => void;
  readonly takeObservedReadDepths: () => readonly number[];
}

function createMemoryDatabase(): MemoryDatabase {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(QUEUED_MUTATIONS_TABLE_SQL);
  sqlite.exec(MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL);
  sqlite.exec(MOBILE_V2_SNAPSHOT_METADATA_TABLE_SQL);
  sqlite.exec(MOBILE_V2_RECONCILIATION_EXPECTATIONS_SQL);
  let failingProgramId: string | null = null;
  let afterWrite: (() => void | Promise<void>) | null = null;
  let beforeCommit: (() => Promise<void>) | null = null;
  let transactionDepth = 0;
  let observedReadDepths: number[] = [];

  const client: DatabaseClient = {
    execAsync: async (source) => {
      sqlite.exec(source);
    },
    runAsync: async (source, ...params) => {
      if (
        failingProgramId !== null &&
        source.includes('INSERT INTO mobile_v2_program_summaries') &&
        params.includes(failingProgramId)
      ) {
        throw new Error('simulated write failure');
      }
      sqlite.prepare(source).run(...params.map(toNodeBindValue));
      await afterWrite?.();
    },
    getAllAsync: async (source, ...params) => {
      observedReadDepths.push(transactionDepth);
      return sqlite.prepare(source).all(...params.map(toNodeBindValue));
    },
    withExclusiveTransactionAsync: async (task) => {
      sqlite.exec('BEGIN IMMEDIATE');
      transactionDepth += 1;
      try {
        await task(client);
        await beforeCommit?.();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      } finally {
        transactionDepth -= 1;
      }
    },
  };

  return {
    client,
    sqlite,
    setFailingProgramId: (programId) => {
      failingProgramId = programId;
    },
    setAfterWrite: (callback) => {
      afterWrite = callback;
    },
    setBeforeCommit: (callback) => {
      beforeCommit = callback;
    },
    takeObservedReadDepths: () => {
      const depths = observedReadDepths;
      observedReadDepths = [];
      return depths;
    },
  };
}

function toNodeBindValue(value: SQLiteBindValue): SQLInputValue {
  return typeof value === 'boolean' ? Number(value) : value;
}

const ACTIVE = {
  id: 'program-active',
  programId: 'gzclp',
  title: 'Active program',
  status: 'active',
  createdAt: '2026-07-27T08:00:00.000Z',
  updatedAt: '2026-07-27T12:00:00.000Z',
} as const;
const COMPLETED = {
  ...ACTIVE,
  id: 'program-completed',
  title: 'Completed program',
  status: 'completed',
  updatedAt: '2026-07-27T11:00:00.000Z',
} as const;
const ARCHIVED = {
  ...ACTIVE,
  id: 'program-archived',
  title: 'Archived program',
  status: 'archived',
  updatedAt: '2026-07-27T10:00:00.000Z',
} as const;

const CATALOG_ENTRY = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Linear progression',
  author: 'Gravity Room',
  category: 'strength',
  level: 'beginner',
  source: 'preset',
  totalWorkouts: 36,
  workoutsPerWeek: 3,
  cycleLength: 3,
} satisfies CatalogEntry;

const DEFINITION = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Linear progression',
  author: 'Gravity Room',
  version: 1,
  category: 'strength',
  source: 'preset',
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 'T1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
  cycleLength: 1,
  totalWorkouts: 12,
  workoutsPerWeek: 3,
  exercises: { squat: { name: 'Squat' } },
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 }],
  weightIncrements: { T1: 2.5 },
} satisfies ProgramDefinition;

const DETAIL = {
  id: ACTIVE.id,
  programId: 'gzclp',
  name: ACTIVE.title,
  config: { squat: 20 },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: ACTIVE.createdAt,
  updatedAt: ACTIVE.updatedAt,
} satisfies GenericProgramDetail;

function readCount(sqlite: DatabaseSync, source: string, ...params: SQLiteBindValue[]): number {
  const row = sqlite.prepare(source).get(...params.map(toNodeBindValue));
  const count = row?.count;
  if (typeof count !== 'number') {
    throw new Error('Expected a numeric count');
  }
  return count;
}

describe('M2 program repository', () => {
  let memory: MemoryDatabase;
  const session = {
    ownerUserId: 'user-a',
    accessToken: 'token-a',
    generation: 1,
  } satisfies AuthorizedSession;

  async function cacheCreatedProgram(
    input: Omit<Parameters<typeof cacheCreatedProgramRepository>[0], 'libraryLease'> & {
      readonly libraryLease?: Parameters<typeof cacheCreatedProgramRepository>[0]['libraryLease'];
    }
  ): Promise<void> {
    const libraryLease =
      input.libraryLease ??
      (await captureProgramRefreshLease(input.ownerUserId, 'library', {
        ...session,
        ownerUserId: input.ownerUserId,
      }));
    await cacheCreatedProgramRepository({ ...input, libraryLease });
  }

  beforeEach(() => {
    memory = createMemoryDatabase();
    mockDatabaseClient = memory.client;
    jest.mocked(isAuthorizedSessionCurrent).mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    memory.sqlite.close();
  });

  it('rejects an older producer after a newer producer has committed durable state', async () => {
    const olderLease = await captureProgramRefreshLease('user-a', 'library', session);
    const newerLease = await captureProgramRefreshLease('user-a', 'library', session);

    expect(olderLease.generation).toBeLessThan(newerLease.generation);
    let olderSettled = false;
    const olderCommit = commitProgramSummariesRefresh(olderLease, [
      { ...ACTIVE, title: 'Stale response' },
    ]).then((committed) => {
      olderSettled = true;
      return committed;
    });
    await Promise.resolve();
    expect(olderSettled).toBe(false);
    await expect(
      commitProgramSummariesRefresh(newerLease, [{ ...ACTIVE, title: 'Newest response' }])
    ).resolves.toBe(true);
    await expect(olderCommit).resolves.toBe(false);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      { ...ACTIVE, title: 'Newest response' },
    ]);
  });

  it('never lets an older producer commit after a newer producer was captured', async () => {
    const olderLease = await captureProgramRefreshLease('user-a', 'library', session);
    const newerLease = await captureProgramRefreshLease('user-a', 'library', session);
    let olderSettled = false;
    const olderCommit = commitProgramSummariesRefresh(olderLease, [
      { ...ACTIVE, title: 'Last successful response' },
    ]).then((committed) => {
      olderSettled = true;
      return committed;
    });

    await Promise.resolve();
    expect(olderSettled).toBe(false);
    await abandonProgramRefreshLease(newerLease);

    await expect(olderCommit).resolves.toBe(false);
    await expect(readProgramLibrarySnapshot('user-a')).resolves.toEqual({
      status: 'no_snapshot',
      data: [],
    });
  });

  it('does not wait on an intermediate lease after the latest generation settles', async () => {
    const olderLease = await captureProgramRefreshLease('user-a', 'library', session);
    const intermediateLease = await captureProgramRefreshLease('user-a', 'library', session);
    const latestLease = await captureProgramRefreshLease('user-a', 'library', session);
    const olderCommit = commitProgramSummariesRefresh(olderLease, [
      { ...ACTIVE, title: 'Irreversibly stale response' },
    ]);

    await Promise.resolve();
    expect(getNewerProgramRefreshLeaseSettlement(olderLease)).not.toBeNull();
    await abandonProgramRefreshLease(latestLease);
    const waiterAfterLatestSettled = getNewerProgramRefreshLeaseSettlement(olderLease);
    await abandonProgramRefreshLease(intermediateLease);

    expect(waiterAfterLatestSettled).toBeNull();
    await expect(olderCommit).resolves.toBe(false);
  });

  it('tracks the latest viable pending producer as current before it commits', async () => {
    const olderLease = await captureProgramRefreshLease('user-a', 'library', session);
    expect(isProgramRefreshLeaseCurrent(olderLease)).toBe(true);

    const newerLease = await captureProgramRefreshLease('user-a', 'library', session);
    expect(isProgramRefreshLeaseCurrent(olderLease)).toBe(false);
    expect(isProgramRefreshLeaseCurrent(newerLease)).toBe(true);

    await abandonProgramRefreshLease(newerLease);
    expect(isProgramRefreshLeaseCurrent(olderLease)).toBe(false);

    await advanceProgramRefreshGeneration('user-a', 'library');
    expect(isProgramRefreshLeaseCurrent(olderLease)).toBe(false);
  });

  it('does not let an abandoned producer commit if its request finishes later', async () => {
    const lease = await captureProgramRefreshLease('user-a', 'library', session);

    await abandonProgramRefreshLease(lease);

    await expect(
      commitProgramSummariesRefresh(lease, [{ ...ACTIVE, title: 'Late abandoned response' }])
    ).resolves.toBe(false);
    await expect(readProgramLibrarySnapshot('user-a')).resolves.toEqual({
      status: 'no_snapshot',
      data: [],
    });
  });

  it('wakes producers waiting on leases invalidated by a mutation', async () => {
    const olderLease = await captureProgramRefreshLease('user-a', 'library', session);
    const newerLease = await captureProgramRefreshLease('user-a', 'library', session);
    let olderSettled = false;
    const olderCommit = commitProgramSummariesRefresh(olderLease, [
      { ...ACTIVE, title: 'Mutation-invalidated response' },
    ]).then((committed) => {
      olderSettled = true;
      return committed;
    });
    await Promise.resolve();
    expect(olderSettled).toBe(false);

    await advanceProgramRefreshGeneration('user-a', 'library');

    await expect(olderCommit).resolves.toBe(false);
    await expect(
      commitProgramSummariesRefresh(newerLease, [{ ...ACTIVE, title: 'Late newer response' }])
    ).resolves.toBe(false);
  });

  it('rolls back a refresh if its lease becomes obsolete during SQLite writes', async () => {
    await replaceProgramSummaries('user-a', [ACTIVE]);
    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    memory.setAfterWrite(() => {
      memory.setAfterWrite(null);
      jest.mocked(isAuthorizedSessionCurrent).mockReturnValue(false);
    });

    await expect(
      commitProgramSummariesRefresh(lease, [{ ...ACTIVE, title: 'Stale in-flight write' }])
    ).resolves.toBe(false);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE]);
  });

  it('commits safely before a newer producer acquires the barrier', async () => {
    const olderLease = await captureProgramRefreshLease('user-a', 'library', session);
    let releaseCommit = (): void => undefined;
    let markCommitStarted = (): void => undefined;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    const commitReleased = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    memory.setBeforeCommit(async () => {
      markCommitStarted();
      await commitReleased;
    });

    const olderCommit = commitProgramSummariesRefresh(olderLease, [
      { ...ACTIVE, title: 'Older boundary response' },
    ]);
    await commitStarted;
    const newerLeasePromise = captureProgramRefreshLease('user-a', 'library', session);
    releaseCommit();

    await expect(olderCommit).resolves.toBe(true);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      { ...ACTIVE, title: 'Older boundary response' },
    ]);
    const newerLease = await newerLeasePromise;
    memory.setBeforeCommit(null);
    await expect(
      commitProgramSummariesRefresh(newerLease, [{ ...ACTIVE, title: 'Winning response' }])
    ).resolves.toBe(true);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      { ...ACTIVE, title: 'Winning response' },
    ]);
  });

  it('reports a library commit after the session changes beyond its rollback point', async () => {
    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    memory.setBeforeCommit(async () => {
      jest.mocked(isAuthorizedSessionCurrent).mockReturnValue(false);
    });
    const committed = { ...ACTIVE, title: 'Committed at the transaction boundary' };

    await expect(commitProgramSummariesRefresh(lease, [committed])).resolves.toBe(true);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([committed]);
  });

  it('serializes abandonment after a transaction has crossed its rollback point', async () => {
    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    let markCommitStarted = (): void => undefined;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    let releaseCommit = (): void => undefined;
    const commitReleased = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    memory.setBeforeCommit(async () => {
      markCommitStarted();
      await commitReleased;
    });
    const committed = { ...ACTIVE, title: 'Committed before unmount cleanup' };
    const pendingCommit = commitProgramSummariesRefresh(lease, [committed]);
    await commitStarted;

    let abandonmentFinished = false;
    const pendingAbandonment = abandonProgramRefreshLease(lease).then(() => {
      abandonmentFinished = true;
    });
    await Promise.resolve();
    expect(abandonmentFinished).toBe(false);
    releaseCommit();

    await expect(pendingCommit).resolves.toBe(true);
    await pendingAbandonment;
    expect(abandonmentFinished).toBe(true);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([committed]);
  });

  it('reports a definition commit after the session changes beyond its rollback point', async () => {
    const lease = await captureProgramRefreshLease(
      'user-a',
      `definition:${DEFINITION.id}`,
      session
    );
    memory.setBeforeCommit(async () => {
      jest.mocked(isAuthorizedSessionCurrent).mockReturnValue(false);
    });

    await expect(commitProgramDefinitionRefresh(lease, DEFINITION)).resolves.toBe(true);
    await expect(getProgramDefinition('user-a', DEFINITION.id)).resolves.toEqual(DEFINITION);
  });

  it('serializes generation invalidation with the SQLite commit boundary', async () => {
    await replaceProgramSummaries('user-a', [ACTIVE]);
    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    let releaseCommit = (): void => undefined;
    let markCommitStarted = (): void => undefined;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    const commitReleased = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    memory.setBeforeCommit(async () => {
      markCommitStarted();
      await commitReleased;
    });

    const pendingCommit = commitProgramSummariesRefresh(lease, [
      { ...ACTIVE, title: 'Committed before mutation' },
    ]);
    await commitStarted;
    let invalidationFinished = false;
    const pendingInvalidation = advanceProgramRefreshGeneration('user-a', 'library').then(() => {
      invalidationFinished = true;
    });
    await Promise.resolve();
    expect(invalidationFinished).toBe(false);

    releaseCommit();

    await expect(pendingCommit).resolves.toBe(true);
    await pendingInvalidation;
    expect(invalidationFinished).toBe(true);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      { ...ACTIVE, title: 'Committed before mutation' },
    ]);
  });

  it('orders a queued refresh capture before a later mutation invalidation', async () => {
    let markBarrierStarted = (): void => undefined;
    const barrierStarted = new Promise<void>((resolve) => {
      markBarrierStarted = resolve;
    });
    let releaseBarrier = (): void => undefined;
    const barrierReleased = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const heldBarrier = withProgramRefreshCommitBarrier('user-a', 'library', async () => {
      markBarrierStarted();
      await barrierReleased;
    });
    await barrierStarted;

    const queuedLease = captureProgramRefreshLease('user-a', 'library', session);
    await Promise.resolve();
    const queuedMutation = advanceProgramRefreshGeneration('user-a', 'library');
    releaseBarrier();

    await heldBarrier;
    const lease = await queuedLease;
    await queuedMutation;
    await expect(
      commitProgramSummariesRefresh(lease, [{ ...ACTIVE, title: 'Pre-mutation response' }])
    ).resolves.toBe(false);
    await expect(readProgramLibrarySnapshot('user-a')).resolves.toEqual({
      status: 'no_snapshot',
      data: [],
    });
  });

  it('serializes definition invalidation with the SQLite commit boundary', async () => {
    const resource = `definition:${DEFINITION.id}` as const;
    const lease = await captureProgramRefreshLease('user-a', resource, session);
    let releaseCommit = (): void => undefined;
    let markCommitStarted = (): void => undefined;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    const commitReleased = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    memory.setBeforeCommit(async () => {
      markCommitStarted();
      await commitReleased;
    });

    const pendingCommit = commitProgramDefinitionRefresh(lease, DEFINITION);
    await commitStarted;
    let invalidationFinished = false;
    const pendingInvalidation = advanceProgramRefreshGeneration('user-a', resource).then(() => {
      invalidationFinished = true;
    });
    await Promise.resolve();
    expect(invalidationFinished).toBe(false);

    releaseCommit();

    await expect(pendingCommit).resolves.toBe(true);
    await pendingInvalidation;
    expect(invalidationFinished).toBe(true);
    await expect(getProgramDefinition('user-a', DEFINITION.id)).resolves.toEqual(DEFINITION);
  });

  it('holds the detail mutation barrier through the local SQLite commit', async () => {
    let releaseCommit = (): void => undefined;
    let markCommitStarted = (): void => undefined;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    const commitReleased = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    memory.setBeforeCommit(async () => {
      markCommitStarted();
      await commitReleased;
    });

    const pendingWrite = upsertProgramDetail('user-a', DETAIL);
    await commitStarted;
    let captureFinished = false;
    const pendingLease = captureProgramRefreshLease('user-a', `detail:${DETAIL.id}`, session).then(
      (lease) => {
        captureFinished = true;
        return lease;
      }
    );
    await Promise.resolve();
    expect(captureFinished).toBe(false);

    releaseCommit();

    await pendingWrite;
    await expect(pendingLease).resolves.toMatchObject({
      ownerUserId: 'user-a',
      resource: `detail:${DETAIL.id}`,
    });
  });

  it('holds create barriers for library, detail and definition through one SQLite commit', async () => {
    let releaseCommit = (): void => undefined;
    let markCommitStarted = (): void => undefined;
    const commitStarted = new Promise<void>((resolve) => {
      markCommitStarted = resolve;
    });
    const commitReleased = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    memory.setBeforeCommit(async () => {
      markCommitStarted();
      await commitReleased;
    });

    const pendingWrite = cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });
    await commitStarted;

    let capturedCount = 0;
    const pendingLeases = (
      ['library', `detail:${DETAIL.id}`, `definition:${DEFINITION.id}`] as const
    ).map((resource) =>
      captureProgramRefreshLease('user-a', resource, session).then((lease) => {
        capturedCount += 1;
        return lease;
      })
    );
    await Promise.resolve();
    expect(capturedCount).toBe(0);

    releaseCommit();

    await pendingWrite;
    await expect(Promise.all(pendingLeases)).resolves.toHaveLength(3);
  });

  it('rolls back an acknowledged create when its initiating session changes during commit', async () => {
    const libraryLease = await captureProgramRefreshLease('user-a', 'library', session);
    memory.setAfterWrite(() => {
      jest.mocked(isAuthorizedSessionCurrent).mockReturnValue(false);
    });

    await expect(
      cacheCreatedProgram({
        ownerUserId: 'user-a',
        session,
        libraryLease,
        detail: DETAIL,
        definition: DEFINITION,
        serverPrograms: null,
      })
    ).rejects.toThrow('session changed');

    expect(
      readCount(
        memory.sqlite,
        'SELECT COUNT(*) AS count FROM mobile_v2_program_summaries WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(0);
    expect(
      readCount(
        memory.sqlite,
        'SELECT COUNT(*) AS count FROM mobile_v2_program_definitions WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(0);
  });

  it('rolls back an acknowledged manage when its initiating session changes during commit', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });
    await recordProgramReconciliation('user-a', 'manage', DETAIL.id, {
      type: 'rename',
      name: 'Should roll back',
    });
    jest.mocked(isAuthorizedSessionCurrent).mockReturnValueOnce(true).mockReturnValueOnce(false);

    await expect(
      cacheManagedProgram(
        'user-a',
        { ...DETAIL, name: 'Should roll back' },
        {
          session,
          activationRequested: false,
          mutation: { type: 'rename', name: 'Should roll back' },
        }
      )
    ).rejects.toThrow('session changed');

    const row = memory.sqlite
      .prepare('SELECT title FROM mobile_v2_program_summaries WHERE owner_user_id = ? AND id = ?')
      .get('user-a', DETAIL.id);
    expect(row?.title).toBe(DETAIL.name);
  });

  it.each(['manage', 'delete', 'resolve'] as const)(
    'holds %s library and detail barriers through its SQLite commit',
    async (operation) => {
      await cacheCreatedProgram({
        ownerUserId: 'user-a',
        detail: DETAIL,
        definition: DEFINITION,
        serverPrograms: [ACTIVE],
      });
      if (operation !== 'delete') {
        await recordProgramReconciliation('user-a', 'manage', DETAIL.id, {
          type: 'rename',
          name: 'Verified rename',
        });
      }
      let releaseCommit = (): void => undefined;
      let markCommitStarted = (): void => undefined;
      const commitStarted = new Promise<void>((resolve) => {
        markCommitStarted = resolve;
      });
      const commitReleased = new Promise<void>((resolve) => {
        releaseCommit = resolve;
      });
      memory.setBeforeCommit(async () => {
        markCommitStarted();
        await commitReleased;
      });

      const pendingWrite =
        operation === 'manage'
          ? cacheManagedProgram(
              'user-a',
              { ...DETAIL, name: 'Verified rename' },
              {
                activationRequested: false,
                mutation: { type: 'rename', name: 'Verified rename' },
              }
            )
          : operation === 'delete'
            ? deleteLocalProgramData('user-a', DETAIL.id)
            : resolveProgramReconciliationWithRemoteDetail(
                'user-a',
                {
                  ...DETAIL,
                  name: 'Verified rename',
                },
                session
              );
      await commitStarted;

      let capturedCount = 0;
      const pendingLeases = (['library', `detail:${DETAIL.id}`] as const).map((resource) =>
        captureProgramRefreshLease('user-a', resource, session).then((lease) => {
          capturedCount += 1;
          return lease;
        })
      );
      await Promise.resolve();
      expect(capturedCount).toBe(0);

      releaseCommit();

      await pendingWrite;
      await expect(Promise.all(pendingLeases)).resolves.toHaveLength(2);
    }
  );

  it('holds reconciliation persistence barriers until its SQLite write settles', async () => {
    let releaseWrite = (): void => undefined;
    let markWriteStarted = (): void => undefined;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const writeReleased = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    memory.setAfterWrite(async () => {
      memory.setAfterWrite(null);
      markWriteStarted();
      await writeReleased;
    });

    const pendingWrite = recordProgramReconciliation('user-a', 'delete', DETAIL.id);
    await writeStarted;
    let capturedCount = 0;
    const pendingLeases = (['library', `detail:${DETAIL.id}`] as const).map((resource) =>
      captureProgramRefreshLease('user-a', resource, session).then((lease) => {
        capturedCount += 1;
        return lease;
      })
    );
    await Promise.resolve();
    expect(capturedCount).toBe(0);

    releaseWrite();

    await pendingWrite;
    await expect(Promise.all(pendingLeases)).resolves.toHaveLength(2);
  });

  it('keeps active, completed and archived rows in one owner-scoped snapshot', async () => {
    await replaceProgramSummaries('user-a', [ACTIVE, COMPLETED, ARCHIVED]);
    await replaceProgramSummaries('user-b', [{ ...ACTIVE, title: 'B private' }]);

    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE, COMPLETED, ARCHIVED]);
    await expect(listProgramSummaries('user-b')).resolves.toEqual([
      { ...ACTIVE, title: 'B private' },
    ]);
  });

  it('distinguishes no snapshot from a successful empty snapshot per owner and resource', async () => {
    await expect(readProgramLibrarySnapshot('user-a')).resolves.toEqual({
      status: 'no_snapshot',
      data: [],
    });
    await expect(readProgramCatalogSnapshot('user-a')).resolves.toEqual({
      status: 'no_snapshot',
      data: [],
    });

    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    await expect(commitProgramSummariesRefresh(lease, [])).resolves.toBe(true);
    await replaceCachedCatalog('user-a', []);

    await expect(readProgramLibrarySnapshot('user-a')).resolves.toMatchObject({
      status: 'snapshot_empty',
      data: [],
    });
    await expect(readProgramCatalogSnapshot('user-a')).resolves.toMatchObject({
      status: 'snapshot_empty',
      data: [],
    });
    await expect(readProgramLibrarySnapshot('user-b')).resolves.toEqual({
      status: 'no_snapshot',
      data: [],
    });
    await expect(readProgramCatalogSnapshot('user-b')).resolves.toEqual({
      status: 'no_snapshot',
      data: [],
    });
  });

  it('returns an acknowledged create as partial data without claiming a full snapshot', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });

    await expect(readProgramLibrarySnapshot('user-a')).resolves.toEqual({
      status: 'no_snapshot',
      data: [ACTIVE],
    });
  });

  it('prevents a definition refresh started before create from overwriting create truth', async () => {
    const lease = await captureProgramRefreshLease(
      'user-a',
      `definition:${DEFINITION.id}`,
      session
    );
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });

    await expect(
      commitProgramDefinitionRefresh(lease, {
        ...DEFINITION,
        name: 'Stale definition response',
      })
    ).resolves.toBe(false);
    await expect(getProgramDefinition('user-a', DEFINITION.id)).resolves.toEqual(DEFINITION);
  });

  it('settles detail and definition leases rejected for response ID mismatches', async () => {
    const detailLease = await captureProgramRefreshLease('user-a', `detail:${DETAIL.id}`, session);
    const definitionLease = await captureProgramRefreshLease(
      'user-a',
      `definition:${DEFINITION.id}`,
      session
    );

    await expect(
      commitProgramDetailRefresh(detailLease, { ...DETAIL, id: 'different-instance' })
    ).resolves.toBe(false);
    await expect(
      commitProgramDefinitionRefresh(definitionLease, {
        ...DEFINITION,
        id: 'different-definition',
      })
    ).resolves.toBe(false);

    expect(isProgramRefreshLeaseCurrent(detailLease)).toBe(false);
    expect(isProgramRefreshLeaseCurrent(definitionLease)).toBe(false);
  });

  it('prevents an older detail producer from recreating a row pruned by a library snapshot', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    const detailLease = await captureProgramRefreshLease('user-a', `detail:${DETAIL.id}`, session);
    const libraryLease = await captureProgramRefreshLease('user-a', 'library', session);

    await expect(commitProgramSummariesRefresh(libraryLease, [])).resolves.toBe(true);
    await expect(
      commitProgramDetailRefresh(detailLease, {
        ...DETAIL,
        name: 'Stale detail response',
      })
    ).resolves.toBe(false);
    await expect(getProgramDetail('user-a', DETAIL.id)).resolves.toBeNull();
  });

  it('invalidates a pending detail producer absent from the local library cache', async () => {
    const absentDetail = {
      ...DETAIL,
      id: 'program-never-cached',
      name: 'Never cached program',
    } satisfies GenericProgramDetail;
    const detailLease = await captureProgramRefreshLease(
      'user-a',
      `detail:${absentDetail.id}`,
      session
    );
    const libraryLease = await captureProgramRefreshLease('user-a', 'library', session);

    await expect(commitProgramSummariesRefresh(libraryLease, [])).resolves.toBe(true);
    await expect(commitProgramDetailRefresh(detailLease, absentDetail)).resolves.toBe(false);
    await expect(getProgramDetail('user-a', absentDetail.id)).resolves.toBeNull();
  });

  it('invalidates an older displaced detail producer when create hands off activation', async () => {
    const displacedDetail = {
      ...DETAIL,
      id: COMPLETED.id,
      name: COMPLETED.title,
      status: 'active',
      updatedAt: COMPLETED.updatedAt,
    } satisfies GenericProgramDetail;
    await replaceProgramSummaries('user-a', [{ ...COMPLETED, status: 'active' }]);
    await upsertProgramDetail('user-a', displacedDetail);
    const displacedLease = await captureProgramRefreshLease(
      'user-a',
      `detail:${displacedDetail.id}`,
      session
    );

    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });

    await expect(commitProgramDetailRefresh(displacedLease, displacedDetail)).resolves.toBe(false);
    await expect(getProgramDetail('user-a', displacedDetail.id)).resolves.toMatchObject({
      id: displacedDetail.id,
      status: 'completed',
    });
  });

  it('invalidates an older displaced detail producer when manage hands off activation', async () => {
    const displacedDetail = {
      ...DETAIL,
      id: COMPLETED.id,
      name: COMPLETED.title,
      status: 'active',
      updatedAt: COMPLETED.updatedAt,
    } satisfies GenericProgramDetail;
    await replaceProgramSummaries('user-a', [ACTIVE, { ...COMPLETED, status: 'active' }]);
    await upsertProgramDetail('user-a', DETAIL);
    await upsertProgramDetail('user-a', displacedDetail);
    const displacedLease = await captureProgramRefreshLease(
      'user-a',
      `detail:${displacedDetail.id}`,
      session
    );
    await recordProgramReconciliation('user-a', 'manage', DETAIL.id, {
      type: 'set_status',
      status: 'active',
    });

    await cacheManagedProgram('user-a', DETAIL, {
      activationRequested: true,
      mutation: { type: 'set_status', status: 'active' },
    });

    await expect(commitProgramDetailRefresh(displacedLease, displacedDetail)).resolves.toBe(false);
    await expect(getProgramDetail('user-a', displacedDetail.id)).resolves.toMatchObject({
      id: displacedDetail.id,
      status: 'completed',
    });
  });

  it('rejects a create list fetched before a later mutation of another program', async () => {
    const laterMutation = { ...ARCHIVED, title: 'Later acknowledged rename' };
    const staleOtherProgram = { ...ARCHIVED, title: 'Pre-mutation name' };
    const libraryLease = await captureProgramRefreshLease('user-a', 'library', session);

    await advanceProgramMutationGenerations('user-a', ARCHIVED.id);
    await replaceProgramSummaries('user-a', [ACTIVE, laterMutation]);

    await expect(
      cacheCreatedProgramRepository({
        ownerUserId: 'user-a',
        session,
        libraryLease,
        detail: DETAIL,
        definition: DEFINITION,
        serverPrograms: [ACTIVE, staleOtherProgram],
      })
    ).rejects.toThrow('Program refresh lease became obsolete');
    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE, laterMutation]);
  });

  it('rejects an obsolete owner producer at the repository boundary', async () => {
    await replaceProgramSummaries('user-a', [ACTIVE]);
    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    jest.mocked(isAuthorizedSessionCurrent).mockReturnValue(false);

    await expect(
      commitProgramSummariesRefresh(lease, [{ ...ACTIVE, title: 'Owner B response' }])
    ).resolves.toBe(false);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE]);
    await expect(listProgramSummaries('user-b')).resolves.toEqual([]);
  });

  it('does not let a list refresh started before create replace the created program', async () => {
    await replaceProgramSummaries('user-a', []);
    const lease = await captureProgramRefreshLease('user-a', 'library', session);

    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });

    await expect(commitProgramSummariesRefresh(lease, [])).resolves.toBe(false);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE]);
  });

  it('does not let a list refresh started before manage replace the acknowledged rename', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'New local truth',
    });
    await cacheManagedProgram(
      'user-a',
      { ...DETAIL, name: 'New local truth' },
      {
        activationRequested: false,
        mutation: { type: 'rename', name: 'New local truth' },
      }
    );

    await expect(commitProgramSummariesRefresh(lease, [ACTIVE])).resolves.toBe(false);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      { ...ACTIVE, title: 'New local truth' },
    ]);
  });

  it('does not let a list refresh started before reactivation undo its pin handoff', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'set_status',
      status: 'archived',
    });
    await cacheManagedProgram(
      'user-a',
      { ...DETAIL, status: 'archived' },
      {
        activationRequested: false,
        mutation: { type: 'set_status', status: 'archived' },
      }
    );
    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'set_status',
      status: 'active',
    });
    await cacheManagedProgram('user-a', DETAIL, {
      activationRequested: true,
      mutation: { type: 'set_status', status: 'active' },
    });

    await expect(
      commitProgramSummariesRefresh(lease, [{ ...ACTIVE, status: 'archived' }])
    ).resolves.toBe(false);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE]);
    await expect(readTrackerProgramId('user-a')).resolves.toBe(ACTIVE.id);
  });

  it('does not let a list refresh started before delete resurrect its tombstone', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    await deleteLocalProgramData('user-a', ACTIVE.id);

    await expect(commitProgramSummariesRefresh(lease, [ACTIVE])).resolves.toBe(false);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([]);
  });

  it('reads each snapshot marker and its rows inside one SQLite transaction', async () => {
    await replaceProgramSummaries('user-a', [ACTIVE]);
    memory.takeObservedReadDepths();

    await readProgramLibrarySnapshot('user-a');

    expect(memory.takeObservedReadDepths()).toEqual([1, 1]);

    await replaceCachedCatalog('user-a', [CATALOG_ENTRY]);
    memory.takeObservedReadDepths();

    await readProgramCatalogSnapshot('user-a');

    expect(memory.takeObservedReadDepths()).toEqual([1, 1]);
  });

  it('rolls back the whole snapshot when one summary insert fails', async () => {
    await replaceProgramSummaries('user-a', [ACTIVE, COMPLETED]);
    memory.setFailingProgramId(ARCHIVED.id);

    await expect(replaceProgramSummaries('user-a', [ARCHIVED])).rejects.toThrow(
      'simulated write failure'
    );
    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE, COMPLETED]);
  });

  it('caches and reads the catalog for offline use without crossing owners', async () => {
    await replaceCachedCatalog('user-a', [CATALOG_ENTRY]);

    await expect(listCachedCatalog('user-a')).resolves.toEqual([CATALOG_ENTRY]);
    await expect(listCachedCatalog('user-b')).resolves.toEqual([]);
  });

  it('rejects a non-preset catalog entry at the SQLite boundary', async () => {
    memory.sqlite
      .prepare(
        `INSERT INTO mobile_v2_program_catalog (
           owner_user_id, id, entry_json, updated_at
         ) VALUES (?, ?, ?, ?)`
      )
      .run(
        'user-a',
        'custom-program',
        JSON.stringify({ ...CATALOG_ENTRY, id: 'custom-program', source: 'custom' }),
        '2026-07-27T12:00:00.000Z'
      );

    await expect(listCachedCatalog('user-a')).rejects.toThrow(
      'SQLite returned an invalid cached catalog entry'
    );
  });

  it('commits created detail, definition, server list and pin in one transaction', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM mobile_v2_program_details WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(1);
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM mobile_v2_program_definitions WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(1);
    expect(
      readCount(
        memory.sqlite,
        `SELECT count(*) AS count
         FROM mobile_v2_program_preferences
         WHERE owner_user_id = ? AND pinned_program_id = ?`,
        'user-a',
        ACTIVE.id
      )
    ).toBe(1);
  });

  it('applies known POST semantics when the follow-up list fails', async () => {
    const oldSummary = {
      ...COMPLETED,
      id: 'old-active',
      title: 'Old active',
      status: 'active' as const,
    };
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: {
        ...DETAIL,
        id: oldSummary.id,
        name: oldSummary.title,
        createdAt: oldSummary.createdAt,
        updatedAt: oldSummary.updatedAt,
      },
      definition: DEFINITION,
      serverPrograms: [oldSummary, ARCHIVED],
    });

    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });

    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      ACTIVE,
      {
        ...oldSummary,
        status: 'completed',
        updatedAt: ACTIVE.updatedAt,
      },
      ARCHIVED,
    ]);
    const oldDetailRow = memory.sqlite
      .prepare(
        `SELECT detail_json
         FROM mobile_v2_program_details
         WHERE owner_user_id = ? AND id = ?`
      )
      .get('user-a', oldSummary.id);
    expect(JSON.parse(String(oldDetailRow?.detail_json))).toMatchObject({
      id: oldSummary.id,
      status: 'completed',
      updatedAt: ACTIVE.updatedAt,
    });
  });

  it('moves a managed instance between lists and clears an inactive pin atomically', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'set_status',
      status: 'archived',
    });

    await cacheManagedProgram(
      'user-a',
      { ...DETAIL, status: 'archived' },
      {
        activationRequested: false,
        mutation: { type: 'set_status', status: 'archived' },
      }
    );

    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      { ...ACTIVE, status: 'archived' },
    ]);
    expect(
      readCount(
        memory.sqlite,
        `SELECT count(*) AS count
         FROM mobile_v2_program_preferences
         WHERE owner_user_id = ? AND pinned_program_id IS NULL`,
        'user-a'
      )
    ).toBe(1);
  });

  it('applies a pending activation handoff from a later authoritative management ACK', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE, COMPLETED],
    });
    await replaceProgramSummaries('user-a', [
      { ...ACTIVE, status: 'completed', updatedAt: '2026-07-27T13:00:00.000Z' },
      { ...COMPLETED, status: 'active', updatedAt: '2026-07-27T13:00:00.000Z' },
    ]);
    await recordProgramReconciliation('user-a', 'manage', COMPLETED.id, {
      type: 'set_status',
      status: 'active',
    });

    await cacheManagedProgram(
      'user-a',
      {
        ...DETAIL,
        id: COMPLETED.id,
        name: COMPLETED.title,
        status: 'active',
        createdAt: COMPLETED.createdAt,
        updatedAt: '2026-07-27T13:00:00.000Z',
      },
      {
        activationRequested: false,
        mutation: { type: 'set_status', status: 'active' },
      }
    );

    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      {
        ...ACTIVE,
        status: 'completed',
        updatedAt: '2026-07-27T13:00:00.000Z',
      },
      {
        ...COMPLETED,
        status: 'active',
        updatedAt: '2026-07-27T13:00:00.000Z',
      },
    ]);
    await expect(readTrackerProgramId('user-a')).resolves.toBe(COMPLETED.id);
    expect(
      memory.sqlite
        .prepare(
          `SELECT json_extract(detail_json, '$.status') AS status
           FROM mobile_v2_program_details
           WHERE owner_user_id = 'user-a' AND id = ?`
        )
        .get(ACTIVE.id)?.status
    ).toBe('completed');
    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([]);
  });

  it('reads durable pending deletes independently from older manage markers', async () => {
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Older pending rename',
    });
    await recordProgramReconciliation('user-a', 'delete', ACTIVE.id);
    await recordProgramReconciliation('user-b', 'delete', COMPLETED.id);

    await expect(readPendingDeleteReconciliations('user-a')).resolves.toEqual([ACTIVE.id]);
    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Older pending rename' },
      },
    ]);

    await clearProgramDeleteReconciliation('user-a', ACTIVE.id);
    await expect(readPendingDeleteReconciliations('user-a')).resolves.toEqual([]);
    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);
  });

  it('resolves pending config when a later acknowledged detail confirms it', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'set_config',
      config: { squat: 25 },
    });

    await cacheManagedProgram(
      'user-a',
      { ...DETAIL, name: 'Later acknowledged name', config: { squat: 25 } },
      {
        activationRequested: false,
        mutation: { type: 'set_config', config: { squat: 25 } },
      }
    );

    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([]);
    expect(
      memory.sqlite
        .prepare(
          `SELECT
             json_extract(detail_json, '$.name') AS name,
             json_extract(detail_json, '$.config.squat') AS squat
           FROM mobile_v2_program_details
           WHERE owner_user_id = 'user-a' AND id = ?`
        )
        .get(ACTIVE.id)
    ).toEqual({ name: 'Later acknowledged name', squat: 25 });
  });

  it('preserves a typed marker across a conflicting record and an unmatched ACK', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Expected name',
    });
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'set_status',
      status: 'archived',
    });

    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Expected name' },
      },
    ]);

    await expect(
      cacheManagedProgram(
        'user-a',
        { ...DETAIL, status: 'archived' },
        {
          activationRequested: false,
          mutation: { type: 'set_status', status: 'archived' },
        }
      )
    ).rejects.toThrow('does not match the durable expectation');

    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Expected name' },
      },
    ]);
    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE]);
  });

  it('preserves an absent Tracker pin when renaming an already-active program', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    memory.sqlite
      .prepare(
        `UPDATE mobile_v2_program_preferences
         SET pinned_program_id = NULL
         WHERE owner_user_id = ?`
      )
      .run('user-a');
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Renamed active program',
    });

    await cacheManagedProgram(
      'user-a',
      { ...DETAIL, name: 'Renamed active program' },
      {
        activationRequested: false,
        mutation: { type: 'rename', name: 'Renamed active program' },
      }
    );

    await expect(readTrackerProgramId('user-a')).resolves.toBeNull();
    await expect(listProgramSummaries('user-a')).resolves.toEqual([
      { ...ACTIVE, title: 'Renamed active program' },
    ]);
  });

  it('preserves pending operational detail and queued mutation during management', async () => {
    const pendingDetail = {
      ...DETAIL,
      results: { '0': { 'squat-t1': { result: 'success' as const } } },
      undoHistory: [{ i: 0, slotId: 'squat-t1' }],
    };
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: pendingDetail,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    memory.sqlite
      .prepare(
        `INSERT INTO queued_mutations (
           entity_type, entity_id, operation, payload_json, created_at
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .run('program', ACTIVE.id, 'result', '{"pending":true}', '2026-07-27T12:05:00.000Z');
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Renamed remotely',
    });

    await cacheManagedProgram(
      'user-a',
      {
        ...DETAIL,
        name: 'Renamed remotely',
        status: 'archived',
        results: {},
        undoHistory: [],
      },
      {
        activationRequested: false,
        mutation: { type: 'rename', name: 'Renamed remotely' },
      }
    );

    const row = memory.sqlite
      .prepare(
        `SELECT detail_json
         FROM mobile_v2_program_details
         WHERE owner_user_id = ? AND id = ?`
      )
      .get('user-a', ACTIVE.id);
    const parsed: unknown = JSON.parse(String(row?.detail_json));
    expect(parsed).toMatchObject({
      name: 'Renamed remotely',
      status: 'archived',
      results: pendingDetail.results,
      undoHistory: pendingDetail.undoHistory,
    });
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM queued_mutations WHERE entity_id = ?',
        ACTIVE.id
      )
    ).toBe(1);
  });

  it('deletes summary, detail, pin and pending queue atomically while preserving other entities', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    await replaceProgramSummaries('user-a', [ACTIVE, ARCHIVED]);
    memory.sqlite.exec(`
      INSERT INTO queued_mutations (
        entity_type, entity_id, operation, payload_json, created_at
      ) VALUES
        ('program', '${ACTIVE.id}', 'result', '{"pending":true}', '2026-07-27T12:00:00.000Z'),
        ('program', '${ARCHIVED.id}', 'result', '{"pending":true}', '2026-07-27T12:00:01.000Z');
    `);
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Pending typed rename',
    });
    await recordProgramReconciliation('user-a', 'create', ACTIVE.id);
    await recordProgramReconciliation('user-a', 'delete', ACTIVE.id);
    memory.sqlite
      .prepare(
        `INSERT INTO mobile_v2_program_reconciliations (
           owner_user_id, operation, entity_id, created_at
         ) VALUES (?, 'manage', ?, ?)`
      )
      .run('user-a', ARCHIVED.id, '2026-07-27T12:00:02.000Z');
    memory.sqlite
      .prepare(
        `INSERT INTO mobile_v2_program_reconciliations (
           owner_user_id, operation, entity_id, created_at
         ) VALUES (?, 'manage', ?, ?)`
      )
      .run('user-b', ACTIVE.id, '2026-07-27T12:00:03.000Z');

    await deleteLocalProgramData('user-a', ACTIVE.id);

    await expect(listProgramSummaries('user-a')).resolves.toEqual([ARCHIVED]);
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM mobile_v2_program_details WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(0);
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM mobile_v2_program_definitions WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(1);
    expect(
      readCount(
        memory.sqlite,
        `SELECT count(*) AS count
         FROM mobile_v2_program_reconciliations
         WHERE owner_user_id = ? AND entity_id = ?`,
        'user-a',
        ACTIVE.id
      )
    ).toBe(0);
    expect(
      readCount(
        memory.sqlite,
        `SELECT count(*) AS count
         FROM mobile_v2_program_reconciliations
         WHERE (owner_user_id = ? AND entity_id = ?)
            OR (owner_user_id = ? AND entity_id = ?)`,
        'user-a',
        ARCHIVED.id,
        'user-b',
        ACTIVE.id
      )
    ).toBe(2);
    expect(
      readCount(
        memory.sqlite,
        `SELECT count(*) AS count
         FROM mobile_v2_program_preferences
         WHERE owner_user_id = ? AND pinned_program_id IS NULL`,
        'user-a'
      )
    ).toBe(1);
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM queued_mutations WHERE entity_id = ?',
        ACTIVE.id
      )
    ).toBe(0);
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM queued_mutations WHERE entity_id = ?',
        ARCHIVED.id
      )
    ).toBe(1);
  });

  it('confirms a pending delete from server absence and clears its local queue', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    memory.sqlite
      .prepare(
        `INSERT INTO queued_mutations (
           entity_type, entity_id, operation, payload_json, created_at
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .run('program', ACTIVE.id, 'result', '{"pending":true}', '2026-07-27T12:05:00.000Z');
    await recordProgramReconciliation('user-a', 'delete', ACTIVE.id);

    const lease = await captureProgramRefreshLease('user-a', 'library', session);
    await expect(commitProgramSummariesRefresh(lease, [])).resolves.toBe(true);

    await expect(listProgramSummaries('user-a')).resolves.toEqual([]);
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM mobile_v2_program_details WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(0);
    await expect(readTrackerProgramId('user-a')).resolves.toBeNull();
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM queued_mutations WHERE entity_id = ?',
        ACTIVE.id
      )
    ).toBe(0);
    expect(
      readCount(
        memory.sqlite,
        `SELECT count(*) AS count
         FROM mobile_v2_program_reconciliations
         WHERE owner_user_id = ? AND operation = 'delete' AND entity_id = ?`,
        'user-a',
        ACTIVE.id
      )
    ).toBe(0);
  });

  it('keeps an outcome-unknown create blocked until it can be identified safely', async () => {
    await recordProgramReconciliation('user-a', 'create', 'unknown:gzclp');

    await replaceProgramSummaries('user-a', []);

    await expect(readPendingCreateReconciliation('user-a')).resolves.toEqual({
      pending: true,
      programInstanceId: null,
    });
  });

  it('resolves a known create marker only when full server truth contains its ID', async () => {
    await recordProgramReconciliation('user-a', 'create', ACTIVE.id);

    await replaceProgramSummaries('user-a', [ACTIVE]);

    await expect(readPendingCreateReconciliation('user-a')).resolves.toBeNull();
  });

  it('keeps rename and status markers until owner-scoped remote truth matches', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Remote rename',
    });
    await recordProgramReconciliation('user-b', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Other owner rename',
    });

    await replaceProgramSummaries('user-a', [ACTIVE]);
    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);

    await replaceProgramSummaries('user-a', [{ ...ACTIVE, title: 'Remote rename' }]);
    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);
    await expect(
      resolveProgramReconciliationWithRemoteDetail(
        'user-a',
        {
          ...DETAIL,
          name: 'Remote rename',
        },
        session
      )
    ).resolves.toBe(true);
    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([]);
    await expect(readPendingManageReconciliations('user-b')).resolves.toHaveLength(1);
    expect(
      memory.sqlite
        .prepare(
          `SELECT json_extract(detail_json, '$.name') AS name
           FROM mobile_v2_program_details
           WHERE owner_user_id = 'user-a' AND id = ?`
        )
        .get(ACTIVE.id)?.name
    ).toBe('Remote rename');

    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'set_status',
      status: 'archived',
    });
    await replaceProgramSummaries('user-a', [ACTIVE]);
    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);
    await replaceProgramSummaries('user-a', [{ ...ACTIVE, status: 'archived' }]);
    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);
    await expect(
      resolveProgramReconciliationWithRemoteDetail(
        'user-a',
        {
          ...DETAIL,
          name: 'Remote rename',
          status: 'archived',
        },
        session
      )
    ).resolves.toBe(true);
    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([]);
    await expect(readTrackerProgramId('user-a')).resolves.toBeNull();
  });

  it('resolves config only from a verified remote detail and preserves legacy markers', async () => {
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'set_config',
      config: { squat: 25 },
    });

    await replaceProgramSummaries('user-a', [ACTIVE]);
    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);
    await expect(
      resolveProgramReconciliationWithRemoteDetail(
        'user-a',
        {
          ...DETAIL,
          config: { squat: 20 },
        },
        session
      )
    ).resolves.toBe(false);
    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);
    await expect(
      resolveProgramReconciliationWithRemoteDetail(
        'user-a',
        {
          ...DETAIL,
          config: { squat: 25 },
        },
        session
      )
    ).resolves.toBe(true);
    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([]);

    memory.sqlite
      .prepare(
        `INSERT INTO mobile_v2_program_reconciliations (
           owner_user_id, operation, entity_id, created_at
         ) VALUES (?, 'manage', ?, ?)`
      )
      .run('user-a', ACTIVE.id, '2026-07-27T14:00:00.000Z');
    await replaceProgramSummaries('user-a', [{ ...ACTIVE, title: 'Any remote name' }]);
    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([
      { programInstanceId: ACTIVE.id, expectation: null },
    ]);
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Explicit legacy recovery',
    });

    await cacheManagedProgram(
      'user-a',
      {
        ...DETAIL,
        name: 'Explicit legacy recovery',
        config: { squat: 30 },
      },
      {
        activationRequested: false,
        mutation: { type: 'rename', name: 'Explicit legacy recovery' },
      }
    );

    await expect(readPendingManageReconciliations('user-a')).resolves.toEqual([]);
    await expect(readTrackerProgramId('user-a')).resolves.toBeNull();
    expect(
      memory.sqlite
        .prepare(
          `SELECT
             json_extract(detail_json, '$.name') AS name,
             json_extract(detail_json, '$.config.squat') AS squat
           FROM mobile_v2_program_details
           WHERE owner_user_id = 'user-a' AND id = ?`
        )
        .get(ACTIVE.id)
    ).toEqual({ name: 'Explicit legacy recovery', squat: 25 });
  });

  it('rolls back verified detail persistence and marker removal together', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Verified rename',
    });
    memory.setFailingProgramId(ACTIVE.id);

    await expect(
      resolveProgramReconciliationWithRemoteDetail(
        'user-a',
        {
          ...DETAIL,
          name: 'Verified rename',
        },
        session
      )
    ).rejects.toThrow('simulated write failure');

    memory.setFailingProgramId(null);
    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);
    expect(
      memory.sqlite
        .prepare(
          `SELECT json_extract(detail_json, '$.name') AS name
           FROM mobile_v2_program_details
           WHERE owner_user_id = 'user-a' AND id = ?`
        )
        .get(ACTIVE.id)?.name
    ).toBe(DETAIL.name);
  });

  it('rolls back reconciliation writes when the owner session changes mid-transaction', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });
    await recordProgramReconciliation('user-a', 'manage', ACTIVE.id, {
      type: 'rename',
      name: 'Verified rename',
    });

    let sessionCurrent = true;
    jest.mocked(isAuthorizedSessionCurrent).mockImplementation(() => sessionCurrent);
    memory.setAfterWrite(() => {
      memory.setAfterWrite(null);
      sessionCurrent = false;
    });

    await expect(
      resolveProgramReconciliationWithRemoteDetail(
        'user-a',
        {
          ...DETAIL,
          name: 'Verified rename',
        },
        session
      )
    ).rejects.toMatchObject({ name: 'ObsoleteAuthorizedSessionError' });

    await expect(readPendingManageReconciliations('user-a')).resolves.toHaveLength(1);
    expect(
      memory.sqlite
        .prepare(
          `SELECT json_extract(detail_json, '$.name') AS name
           FROM mobile_v2_program_details
           WHERE owner_user_id = 'user-a' AND id = ?`
        )
        .get(ACTIVE.id)?.name
    ).toBe(DETAIL.name);
  });

  it('removes orphaned detail data when full server truth no longer contains the instance', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });

    await replaceProgramSummaries('user-a', []);

    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM mobile_v2_program_details WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(0);
    expect(
      readCount(
        memory.sqlite,
        'SELECT count(*) AS count FROM mobile_v2_program_definitions WHERE owner_user_id = ?',
        'user-a'
      )
    ).toBe(1);
  });
});
