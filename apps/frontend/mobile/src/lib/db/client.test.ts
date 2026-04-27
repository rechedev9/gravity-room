import { openDatabaseSync } from 'expo-sqlite';

import { bootstrapDatabase, getDatabase } from './client';

const mockedOpenDatabaseSync = jest.mocked(openDatabaseSync);

describe('bootstrapDatabase', () => {
  afterEach(() => {
    mockedOpenDatabaseSync.mockReset();
  });

  it('retries bootstrap after a previous failure', async () => {
    const execAsync = jest
      .fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error('disk busy'))
      .mockResolvedValueOnce(undefined);

    mockedOpenDatabaseSync.mockReturnValue({
      execAsync,
      getAllAsync: jest.fn(async () => []),
      runAsync: jest.fn(async () => undefined),
    } as never);

    await expect(bootstrapDatabase()).rejects.toThrow('disk busy');
    await expect(bootstrapDatabase()).resolves.toBeUndefined();

    expect(execAsync).toHaveBeenCalledTimes(2);
  });

  it('returns the same database instance across calls', () => {
    mockedOpenDatabaseSync.mockReturnValue({
      execAsync: jest.fn(async () => undefined),
      getAllAsync: jest.fn(async () => []),
      runAsync: jest.fn(async () => undefined),
    } as never);

    expect(getDatabase()).toBe(getDatabase());
  });
});
