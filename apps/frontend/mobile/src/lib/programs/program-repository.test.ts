interface ProgramSummaryRow {
  readonly id: string;
  readonly title: string;
  readonly updated_at: string;
}

const rows: ProgramSummaryRow[] = [];
let mockFailNextInsert = false;

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
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
            if (sql.includes('DELETE FROM program_summaries WHERE id NOT IN')) {
              const ids = new Set(params as string[]);

              for (let index = rows.length - 1; index >= 0; index -= 1) {
                const row = rows[index];

                if (row && !ids.has(row.id)) {
                  rows.splice(index, 1);
                }
              }
            }

            if (sql === 'DELETE FROM program_summaries') {
              rows.length = 0;
            }

            if (sql.includes('INSERT INTO program_summaries')) {
              if (mockFailNextInsert) {
                mockFailNextInsert = false;
                throw new Error('write failed');
              }

              const [id, title, updatedAt] = params as [string, string, string];
              const existingIndex = rows.findIndex((row) => row.id === id);
              const nextRow = { id, title, updated_at: updatedAt };

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
    getAllAsync: jest.fn(async (sql: string) => {
      if (!sql.includes('SELECT id, title, updated_at FROM program_summaries')) {
        return [];
      }

      return [...rows].sort(
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
