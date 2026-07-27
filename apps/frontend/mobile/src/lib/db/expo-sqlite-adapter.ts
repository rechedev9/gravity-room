import { openDatabaseSync } from 'expo-sqlite';

export interface DatabaseClient {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (client: DatabaseClient) => Promise<void>): Promise<void>;
}

export function openMobileDatabase(): DatabaseClient {
  return openDatabaseSync('gravity-room.db');
}
