/// <reference types="node" />

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { CatalogEntry, GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';
import type { SQLiteBindValue } from 'expo-sqlite';

import type { DatabaseClient } from '../db/expo-sqlite-adapter';
import {
  MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL,
  MOBILE_V2_SNAPSHOT_METADATA_TABLE_SQL,
  QUEUED_MUTATIONS_TABLE_SQL,
} from '../db/schema';

let mockDatabaseClient: DatabaseClient;

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
  getDatabase: jest.fn(() => mockDatabaseClient),
}));

import {
  cacheCreatedProgram,
  cacheManagedProgram,
  deleteLocalProgramData,
  listCachedCatalog,
  listProgramSummaries,
  readProgramCatalogSnapshot,
  readProgramLibrarySnapshot,
  readPendingCreateReconciliation,
  recordProgramReconciliation,
  replaceCachedCatalog,
  replaceProgramSummaries,
} from './program-repository';
import { readTrackerProgramId } from '../tracker/tracker-selection-storage';

interface MemoryDatabase {
  readonly client: DatabaseClient;
  readonly sqlite: DatabaseSync;
  readonly setFailingProgramId: (programId: string | null) => void;
  readonly takeObservedReadDepths: () => readonly number[];
}

function createMemoryDatabase(): MemoryDatabase {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(QUEUED_MUTATIONS_TABLE_SQL);
  sqlite.exec(MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL);
  sqlite.exec(MOBILE_V2_SNAPSHOT_METADATA_TABLE_SQL);
  let failingProgramId: string | null = null;
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

  beforeEach(() => {
    memory = createMemoryDatabase();
    mockDatabaseClient = memory.client;
  });

  afterEach(() => {
    memory.sqlite.close();
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

    await replaceProgramSummaries('user-a', []);
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

    await cacheManagedProgram(
      'user-a',
      { ...DETAIL, status: 'archived' },
      { activationRequested: false }
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

  it('reactivates and pins the target atomically so Tracker resolves the new active program', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE, COMPLETED],
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
      { activationRequested: true }
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

    await cacheManagedProgram(
      'user-a',
      { ...DETAIL, name: 'Renamed active program' },
      { activationRequested: false }
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

    await cacheManagedProgram(
      'user-a',
      {
        ...DETAIL,
        name: 'Renamed remotely',
        status: 'archived',
        results: {},
        undoHistory: [],
      },
      { activationRequested: false }
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

    await replaceProgramSummaries('user-a', []);

    await expect(listProgramSummaries('user-a')).resolves.toEqual([]);
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
