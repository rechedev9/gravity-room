import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { PROGRAM_SUMMARIES_TABLE_SQL } from './schema';

export interface DatabaseClient {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
}

let bootstrapPromise: Promise<void> | null = null;
let database: SQLiteDatabase | null = null;

function asDatabaseClient(client: SQLiteDatabase): DatabaseClient {
  return client;
}

export function getDatabase(): DatabaseClient {
  if (!database) {
    database = openDatabaseSync('gravity-room.db');
  }

  return asDatabaseClient(database);
}

export async function bootstrapDatabase(client: DatabaseClient = getDatabase()): Promise<void> {
  if (client !== database) {
    await client.execAsync(PROGRAM_SUMMARIES_TABLE_SQL);
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = client.execAsync(PROGRAM_SUMMARIES_TABLE_SQL);
  }

  await bootstrapPromise;
}
