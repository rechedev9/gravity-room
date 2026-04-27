import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import {
  PROGRAM_DEFINITIONS_TABLE_SQL,
  PROGRAM_DETAILS_TABLE_SQL,
  PROGRAM_SUMMARIES_TABLE_SQL,
  QUEUED_MUTATIONS_TABLE_SQL,
} from './schema';

const BOOTSTRAP_SQL = `${PROGRAM_SUMMARIES_TABLE_SQL}\n${QUEUED_MUTATIONS_TABLE_SQL}\n${PROGRAM_DETAILS_TABLE_SQL}\n${PROGRAM_DEFINITIONS_TABLE_SQL}`;

export interface DatabaseClient {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (client: DatabaseClient) => Promise<void>): Promise<void>;
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
    await client.execAsync(BOOTSTRAP_SQL);
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = client.execAsync(BOOTSTRAP_SQL).catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
}

export async function clearLocalAppData(client: DatabaseClient = getDatabase()): Promise<void> {
  await bootstrapDatabase(client);

  await client.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM queued_mutations');
    await transaction.runAsync('DELETE FROM program_details');
    await transaction.runAsync('DELETE FROM program_definitions');
    await transaction.runAsync('DELETE FROM program_summaries');
  });
}
