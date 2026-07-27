let mockPinnedProgramId: unknown = null;
const mockActivePrograms = new Set<string>();

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
  getDatabase: jest.fn(() => ({
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => undefined),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('preferences.pinned_program_id')) {
        return mockPinnedProgramId === undefined
          ? []
          : [{ pinned_program_id: mockPinnedProgramId }];
      }
      if (sql.includes('FROM mobile_v2_program_summaries')) {
        const programId = params[1];
        return typeof programId === 'string' && mockActivePrograms.has(programId)
          ? [{ id: programId }]
          : [];
      }
      return [];
    }),
    withExclusiveTransactionAsync: jest.fn(
      async (
        callback: (client: {
          getAllAsync: (sql: string, ...params: unknown[]) => Promise<unknown[]>;
          runAsync: (sql: string, ...params: unknown[]) => Promise<unknown>;
        }) => Promise<void>
      ) => {
        await callback({
          getAllAsync: async (_sql: string, ...params: unknown[]) => {
            const programId = params[1];
            return typeof programId === 'string' && mockActivePrograms.has(programId)
              ? [{ id: programId }]
              : [];
          },
          runAsync: async (_sql: string, ...params: unknown[]) => {
            mockPinnedProgramId = params[1];
            return undefined;
          },
        });
      }
    ),
  })),
}));

import { readTrackerProgramId, writeTrackerProgramId } from './tracker-selection-storage';

describe('tracker selection storage', () => {
  beforeEach(() => {
    mockActivePrograms.clear();
    mockPinnedProgramId = null;
  });

  it('partitions pin reads by owner and rejects malformed persisted identifiers', async () => {
    mockPinnedProgramId = '../profile';

    await expect(readTrackerProgramId('user-a')).resolves.toBeNull();
    await expect(writeTrackerProgramId('user-a', '../profile')).rejects.toThrow(
      'Cannot persist an invalid tracker program identifier'
    );
  });

  it('pins only an active program owned by the authenticated partition', async () => {
    mockActivePrograms.add('program-a');

    await writeTrackerProgramId('user-a', 'program-a');
    await expect(readTrackerProgramId('user-a')).resolves.toBe('program-a');

    await expect(writeTrackerProgramId('user-b', 'program-b')).rejects.toThrow(
      'Only an active owned program can be pinned'
    );
  });
});
