/// <reference types="node" />

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { CatalogEntry, GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';
import type { SQLiteBindValue } from 'expo-sqlite';

import type { DatabaseClient } from '../db/expo-sqlite-adapter';
import { MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL } from '../db/schema';

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
  replaceCachedCatalog,
  replaceProgramSummaries,
} from './program-repository';

interface MemoryDatabase {
  readonly client: DatabaseClient;
  readonly sqlite: DatabaseSync;
  readonly setFailingProgramId: (programId: string | null) => void;
}

function createMemoryDatabase(): MemoryDatabase {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(MOBILE_V2_PROGRAM_LIBRARY_TABLES_SQL);
  let failingProgramId: string | null = null;

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
    getAllAsync: async (source, ...params) =>
      sqlite.prepare(source).all(...params.map(toNodeBindValue)),
    withExclusiveTransactionAsync: async (task) => {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        await task(client);
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return {
    client,
    sqlite,
    setFailingProgramId: (programId) => {
      failingProgramId = programId;
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

  it('merges POST truth without deleting cached programs when the follow-up list fails', async () => {
    await replaceProgramSummaries('user-a', [COMPLETED]);

    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: null,
    });

    await expect(listProgramSummaries('user-a')).resolves.toEqual([ACTIVE, COMPLETED]);
  });

  it('moves a managed instance between lists and clears an inactive pin atomically', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });

    await cacheManagedProgram('user-a', { ...DETAIL, status: 'archived' });

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

  it('deletes only instance-related local data and pin after remote success calls it', async () => {
    await cacheCreatedProgram({
      ownerUserId: 'user-a',
      detail: DETAIL,
      definition: DEFINITION,
      serverPrograms: [ACTIVE],
    });

    await deleteLocalProgramData('user-a', ACTIVE.id);

    await expect(listProgramSummaries('user-a')).resolves.toEqual([]);
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
