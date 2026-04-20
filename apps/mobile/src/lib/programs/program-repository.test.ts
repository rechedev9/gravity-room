interface ProgramSummaryRow {
  readonly id: string;
  readonly title: string;
  readonly updated_at: string;
}

const rows: ProgramSummaryRow[] = [];

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
  getDatabase: jest.fn(() => ({
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('INSERT INTO program_summaries')) {
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
    }),
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
});
