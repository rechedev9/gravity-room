import { openDatabaseSync, type SQLiteBindValue } from 'expo-sqlite';

export interface DatabaseClient {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SQLiteBindValue[]): Promise<unknown>;
  getAllAsync(source: string, ...params: SQLiteBindValue[]): Promise<unknown[]>;
  withExclusiveTransactionAsync(task: (client: DatabaseClient) => Promise<void>): Promise<void>;
}

interface SQLiteConnection {
  execSync(source: string): void;
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SQLiteBindValue[]): Promise<unknown>;
  getAllAsync(source: string, ...params: SQLiteBindValue[]): Promise<unknown[]>;
  withExclusiveTransactionAsync(
    task: (connection: SQLiteConnection) => Promise<void>
  ): Promise<void>;
}

type OpenSQLiteConnection = (databaseName: string) => SQLiteConnection;

function assertForeignKeysEnabled(rows: readonly unknown[]): void {
  const row = rows[0];

  if (
    typeof row !== 'object' ||
    row === null ||
    !('foreign_keys' in row) ||
    row.foreign_keys !== 1
  ) {
    throw new Error('SQLite foreign-key enforcement is disabled');
  }
}

function wrapConnection(connection: SQLiteConnection): DatabaseClient {
  return {
    execAsync: (source) => connection.execAsync(source),
    runAsync: (source, ...params) => connection.runAsync(source, ...params),
    getAllAsync: (source, ...params) => connection.getAllAsync(source, ...params),
    withExclusiveTransactionAsync: (task) =>
      connection.withExclusiveTransactionAsync(async (transaction) => {
        const rows = await transaction.getAllAsync('PRAGMA foreign_keys');
        assertForeignKeysEnabled(rows);
        await task(wrapConnection(transaction));
      }),
  };
}

export function openMobileDatabase(
  openConnection: OpenSQLiteConnection = openDatabaseSync
): DatabaseClient {
  const connection = openConnection('gravity-room.db');
  connection.execSync('PRAGMA foreign_keys = ON');
  return wrapConnection(connection);
}
