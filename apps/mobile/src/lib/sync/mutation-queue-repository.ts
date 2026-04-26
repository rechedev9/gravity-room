import { bootstrapDatabase, getDatabase } from '../db/client';

export type MutationPayload = Record<string, unknown>;

export type EnqueueMutationInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: string;
  readonly payload: MutationPayload;
  readonly createdAt?: string;
};

export type QueuedMutation = {
  readonly id: number;
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: string;
  readonly payload: MutationPayload;
  readonly createdAt: string;
};

type QueuedMutationRow = {
  readonly id: number;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly operation: string;
  readonly payload_json: string;
  readonly created_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePayload(payloadJson: string): MutationPayload {
  try {
    const value: unknown = JSON.parse(payloadJson);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

export async function enqueueMutation(input: EnqueueMutationInput): Promise<void> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  const createdAt = input.createdAt ?? new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO queued_mutations (entity_type, entity_id, operation, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      input.entityType,
      input.entityId,
      input.operation,
      JSON.stringify(input.payload),
      createdAt
    );
  });
}

export async function listQueuedMutations(): Promise<QueuedMutation[]> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<QueuedMutationRow>(
    `SELECT id, entity_type, entity_id, operation, payload_json, created_at
     FROM queued_mutations
     ORDER BY created_at ASC, id ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
  }));
}

export async function acknowledgeQueuedMutations(ids: readonly number[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const database = getDatabase();
  await bootstrapDatabase(database);

  const placeholders = ids.map(() => '?').join(', ');
  await database.runAsync(`DELETE FROM queued_mutations WHERE id IN (${placeholders})`, ...ids);
}

export async function clearQueuedMutations(): Promise<void> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.runAsync('DELETE FROM queued_mutations');
}
