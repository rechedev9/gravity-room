import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

interface ProgramDetailRow {
  readonly id: string;
  readonly program_id: string;
  readonly detail_json: string;
  readonly updated_at: string;
}

interface ProgramDefinitionRow {
  readonly id: string;
  readonly definition_json: string;
  readonly updated_at: string;
}

const mockProgramDetailRows: ProgramDetailRow[] = [];
const mockProgramDefinitionRows: ProgramDefinitionRow[] = [];

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
  getDatabase: jest.fn(() => ({
    withExclusiveTransactionAsync: jest.fn(
      async (
        callback: (client: {
          runAsync: (sql: string, ...params: unknown[]) => Promise<unknown>;
        }) => Promise<void>
      ) => {
        await callback({
          runAsync: async (sql: string, ...params: unknown[]) => {
            if (sql.includes('INSERT INTO program_details')) {
              const [id, programId, detailJson, updatedAt] = params;
              const nextRow: ProgramDetailRow = {
                id: String(id),
                program_id: String(programId),
                detail_json: String(detailJson),
                updated_at: String(updatedAt),
              };
              const existingIndex = mockProgramDetailRows.findIndex((row) => row.id === nextRow.id);
              if (existingIndex >= 0) {
                mockProgramDetailRows[existingIndex] = nextRow;
              } else {
                mockProgramDetailRows.push(nextRow);
              }
              return { changes: 1, lastInsertRowId: 0 };
            }

            if (sql.includes('INSERT INTO program_definitions')) {
              const [id, definitionJson, updatedAt] = params;
              const nextRow: ProgramDefinitionRow = {
                id: String(id),
                definition_json: String(definitionJson),
                updated_at: String(updatedAt),
              };
              const existingIndex = mockProgramDefinitionRows.findIndex(
                (row) => row.id === nextRow.id
              );
              if (existingIndex >= 0) {
                mockProgramDefinitionRows[existingIndex] = nextRow;
              } else {
                mockProgramDefinitionRows.push(nextRow);
              }
              return { changes: 1, lastInsertRowId: 0 };
            }

            return { changes: 0, lastInsertRowId: 0 };
          },
        });
      }
    ),
    runAsync: jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('SELECT id, program_id, detail_json, updated_at FROM program_details')) {
        const requestedId = String(params[0]);
        return mockProgramDetailRows.filter((row) => row.id === requestedId);
      }

      if (sql.includes('SELECT id, definition_json, updated_at FROM program_definitions')) {
        const requestedId = String(params[0]);
        return mockProgramDefinitionRows.filter((row) => row.id === requestedId);
      }

      return [];
    }),
    execAsync: jest.fn(async () => undefined),
  })),
}));

import {
  getProgramDefinition,
  getProgramDetail,
  upsertProgramDefinition,
  upsertProgramDetail,
} from './program-detail-repository';

const TEST_DEFINITION: ProgramDefinition = {
  id: 'test-prog',
  name: 'Test Program',
  description: 'Minimal fixture for tracker cache tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 2,
  totalWorkouts: 4,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    { key: 'bench', label: 'Bench', type: 'weight', min: 20, step: 2.5 },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day B',
      slots: [
        {
          id: 'bench-t1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

const TEST_DETAIL: GenericProgramDetail = {
  id: 'instance-1',
  programId: 'test-prog',
  name: 'Test Program Instance',
  config: {
    squat: 60,
    bench: 40,
  },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:00:00.000Z',
};

describe('program detail repository', () => {
  beforeEach(() => {
    mockProgramDetailRows.length = 0;
    mockProgramDefinitionRows.length = 0;
  });

  it('round-trips cached program detail and definition', async () => {
    await upsertProgramDetail(TEST_DETAIL);
    await upsertProgramDefinition(TEST_DEFINITION);

    await expect(getProgramDetail('instance-1')).resolves.toEqual(TEST_DETAIL);
    await expect(getProgramDefinition('test-prog')).resolves.toEqual(TEST_DEFINITION);
  });

  it('replaces cached rows when newer detail or definition arrives', async () => {
    await upsertProgramDetail(TEST_DETAIL);
    await upsertProgramDefinition(TEST_DEFINITION);

    await upsertProgramDetail({
      ...TEST_DETAIL,
      name: 'Updated Instance',
      updatedAt: '2026-04-21T10:00:00.000Z',
    });
    await upsertProgramDefinition({
      ...TEST_DEFINITION,
      name: 'Updated Definition',
    });

    await expect(getProgramDetail('instance-1')).resolves.toEqual({
      ...TEST_DETAIL,
      name: 'Updated Instance',
      updatedAt: '2026-04-21T10:00:00.000Z',
    });
    await expect(getProgramDefinition('test-prog')).resolves.toEqual({
      ...TEST_DEFINITION,
      name: 'Updated Definition',
    });
  });
});
