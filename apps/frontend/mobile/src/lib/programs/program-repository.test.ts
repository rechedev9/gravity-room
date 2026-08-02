interface ProgramSummaryRow {
  readonly owner_user_id: string;
  readonly id: string;
  readonly title: string;
  readonly updated_at: string;
}

const rows: ProgramSummaryRow[] = [];
let mockFailNextInsert = false;
let mockActiveOwnerId = 'user-a';

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
  requireActiveLocalDataOwner: jest.fn(() => mockActiveOwnerId),
  getDatabase: jest.fn(() => ({
    withExclusiveTransactionAsync: jest.fn(
      async (
        callback: (client: {
          runAsync: (sql: string, ...params: unknown[]) => Promise<unknown>;
        }) => Promise<void>
      ) => {
        const snapshot = rows.map((row) => ({ ...row }));
        const transactionClient = {
          runAsync: async (sql: string, ...params: unknown[]) => {
            if (sql.includes('id NOT IN')) {
              const [ownerId, ...programIds] = params as string[];
              const ids = new Set(programIds);

              for (let index = rows.length - 1; index >= 0; index -= 1) {
                const row = rows[index];

                if (row && row.owner_user_id === ownerId && !ids.has(row.id)) {
                  rows.splice(index, 1);
                }
              }
            }

            if (sql.includes('DELETE FROM program_summaries WHERE owner_user_id')) {
              const ownerId = String(params[0]);
              for (let index = rows.length - 1; index >= 0; index -= 1) {
                if (rows[index]?.owner_user_id === ownerId) rows.splice(index, 1);
              }
            }

            if (sql.includes('INSERT INTO program_summaries')) {
              if (mockFailNextInsert) {
                mockFailNextInsert = false;
                throw new Error('write failed');
              }

              const [ownerId, id, title, updatedAt] = params as [string, string, string, string];
              const existingIndex = rows.findIndex(
                (row) => row.owner_user_id === ownerId && row.id === id
              );
              const nextRow = { owner_user_id: ownerId, id, title, updated_at: updatedAt };

              if (existingIndex >= 0) {
                rows[existingIndex] = nextRow;
              } else {
                rows.push(nextRow);
              }
            }

            return { changes: 1, lastInsertRowId: 0 };
          },
        };

        try {
          await callback(transactionClient);
        } catch (error) {
          rows.length = 0;
          rows.push(...snapshot);
          throw error;
        }
      }
    ),
    runAsync: jest.fn(async () => ({ changes: 1, lastInsertRowId: 0 })),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (!sql.includes('SELECT id, title, updated_at FROM program_summaries')) {
        return [];
      }

      const ownerId = String(params[0]);
      return rows
        .filter((row) => row.owner_user_id === ownerId)
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) || left.title.localeCompare(right.title)
        );
    }),
    execAsync: jest.fn(async () => undefined),
  })),
}));

import { listProgramSummaries, upsertProgramSummaries } from './program-repository';

describe('program repository', () => {
  beforeEach(() => {
    rows.length = 0;
    mockFailNextInsert = false;
    mockActiveOwnerId = 'user-a';
  });

  it.each([
    { ownerId: 'user-a', expectedTitle: 'Account A program' },
    { ownerId: 'user-b', expectedTitle: 'Account B program' },
  ])('returns only the $ownerId partition', async ({ ownerId, expectedTitle }) => {
    rows.push(
      {
        owner_user_id: 'user-a',
        id: 'shared-instance-id',
        title: 'Account A program',
        updated_at: '2026-04-20T08:00:00.000Z',
      },
      {
        owner_user_id: 'user-b',
        id: 'shared-instance-id',
        title: 'Account B program',
        updated_at: '2026-04-20T08:00:00.000Z',
      }
    );
    mockActiveOwnerId = ownerId;

    await expect(listProgramSummaries()).resolves.toEqual([
      {
        id: 'shared-instance-id',
        title: expectedTitle,
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);
  });

  it('reads persisted program summaries back in updated order', async () => {
    await upsertProgramSummaries([
      {
        id: 'program-a',
        title: 'Strength Base',
        updatedAt: '2026-04-18T10:00:00.000Z',
      },
      {
        id: 'program-b',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
      {
        id: 'program-c',
        title: 'Hypertrophy Cycle',
        updatedAt: '2026-04-19T09:30:00.000Z',
      },
    ]);

    await expect(listProgramSummaries()).resolves.toEqual([
      {
        id: 'program-b',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
      {
        id: 'program-c',
        title: 'Hypertrophy Cycle',
        updatedAt: '2026-04-19T09:30:00.000Z',
      },
      {
        id: 'program-a',
        title: 'Strength Base',
        updatedAt: '2026-04-18T10:00:00.000Z',
      },
    ]);
  });

  it('replaces the cached snapshot when rows are removed or emptied', async () => {
    await upsertProgramSummaries([
      {
        id: 'program-a',
        title: 'Strength Base',
        updatedAt: '2026-04-18T10:00:00.000Z',
      },
      {
        id: 'program-b',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);

    await upsertProgramSummaries([
      {
        id: 'program-b',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);

    await expect(listProgramSummaries()).resolves.toEqual([
      {
        id: 'program-b',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);

    await upsertProgramSummaries([]);

    await expect(listProgramSummaries()).resolves.toEqual([]);
  });

  it('rolls back snapshot replacement when a write fails mid-transaction', async () => {
    await upsertProgramSummaries([
      {
        id: 'program-a',
        title: 'Strength Base',
        updatedAt: '2026-04-18T10:00:00.000Z',
      },
      {
        id: 'program-b',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);

    mockFailNextInsert = true;

    await expect(
      upsertProgramSummaries([
        {
          id: 'program-b',
          title: 'Power Block',
          updatedAt: '2026-04-20T08:00:00.000Z',
        },
      ])
    ).rejects.toThrow('write failed');

    await expect(listProgramSummaries()).resolves.toEqual([
      {
        id: 'program-b',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
      {
        id: 'program-a',
        title: 'Strength Base',
        updatedAt: '2026-04-18T10:00:00.000Z',
      },
    ]);
  });
});
