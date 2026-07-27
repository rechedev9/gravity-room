import appConfig from '../../../app.json';

import { openMobileDatabase } from './expo-sqlite-adapter';

type OpenConnection = NonNullable<Parameters<typeof openMobileDatabase>[0]>;
type TestConnection = ReturnType<OpenConnection>;

function createConnection(foreignKeys: number): TestConnection {
  const connection: TestConnection = {
    execSync: jest.fn(),
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
    getAllAsync: jest.fn(async (source: string) =>
      source === 'PRAGMA foreign_keys' ? [{ foreign_keys: foreignKeys }] : []
    ),
    withExclusiveTransactionAsync: jest.fn(async (task) => {
      await task(connection);
    }),
  };

  return connection;
}

describe('Expo SQLite adapter contract', () => {
  it('enables foreign keys on the primary runtime connection', () => {
    const connection = createConnection(1);
    const openConnection = jest.fn(() => connection);

    openMobileDatabase(openConnection);

    expect(openConnection).toHaveBeenCalledWith('gravity-room.db');
    expect(connection.execSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
  });

  it('fails closed when an exclusive transaction opens without foreign keys', async () => {
    const connection = createConnection(0);
    const database = openMobileDatabase(() => connection);
    const task = jest.fn(async () => undefined);

    await expect(database.withExclusiveTransactionAsync(task)).rejects.toThrow(
      'SQLite foreign-key enforcement is disabled'
    );
    expect(task).not.toHaveBeenCalled();
  });

  it('allows an exclusive transaction only after verifying its connection', async () => {
    const connection = createConnection(1);
    const database = openMobileDatabase(() => connection);
    const task = jest.fn(async () => undefined);

    await expect(database.withExclusiveTransactionAsync(task)).resolves.toBeUndefined();
    expect(connection.getAllAsync).toHaveBeenCalledWith('PRAGMA foreign_keys');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('compiles SQLite with foreign keys enabled by default on Android and iOS', () => {
    expect(appConfig.expo.plugins).toContainEqual([
      'expo-sqlite',
      {
        customBuildFlags: '-DSQLITE_DEFAULT_FOREIGN_KEYS=1',
      },
    ]);
  });
});
