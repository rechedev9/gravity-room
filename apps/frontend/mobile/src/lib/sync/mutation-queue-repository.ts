import { isRecord } from '@gzclp/domain/type-guards';
import { bootstrapDatabase, getDatabase } from '../db/client';

export type MutationPayload = Record<string, unknown>;

export type EnqueueMutationInput = {
  readonly ownerUserId: string;
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

function parseQueuedMutationRow(value: unknown): QueuedMutationRow {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    !Number.isSafeInteger(value.id) ||
    typeof value.entity_type !== 'string' ||
    typeof value.entity_id !== 'string' ||
    typeof value.operation !== 'string' ||
    typeof value.payload_json !== 'string' ||
    typeof value.created_at !== 'string'
  ) {
    throw new Error('SQLite returned an invalid queued mutation row');
  }

  return {
    id: value.id,
    entity_type: value.entity_type,
    entity_id: value.entity_id,
    operation: value.operation,
    payload_json: value.payload_json,
    created_at: value.created_at,
  };
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
  const ownerUserId = input.ownerUserId.trim();
  if (!ownerUserId) {
    throw new Error('Queued mutation owner is required');
  }
  const database = getDatabase();
  await bootstrapDatabase(database);

  const createdAt = input.createdAt ?? new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO queued_mutations (owner_user_id, entity_type, entity_id, operation, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ownerUserId,
      input.entityType,
      input.entityId,
      input.operation,
      JSON.stringify(input.payload),
      createdAt
    );
  });
}

export async function listQueuedMutations(ownerUserId: string): Promise<QueuedMutation[]> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync(
    `SELECT id, entity_type, entity_id, operation, payload_json, created_at
     FROM queued_mutations WHERE owner_user_id = ?
     ORDER BY created_at ASC, id ASC`,
    ownerUserId
  );

  return rows.map(parseQueuedMutationRow).map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    payload: parsePayload(row.payload_json),
    createdAt: row.created_at,
  }));
}

export async function acknowledgeQueuedMutations(
  ownerUserId: string,
  ids: readonly number[]
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const database = getDatabase();
  await bootstrapDatabase(database);

  const placeholders = ids.map(() => '?').join(', ');
  await database.runAsync(
    `DELETE FROM queued_mutations WHERE owner_user_id = ? AND id IN (${placeholders})`,
    ownerUserId,
    ...ids
  );
}

export async function clearQueuedMutations(ownerUserId: string): Promise<void> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.runAsync('DELETE FROM queued_mutations WHERE owner_user_id = ?', ownerUserId);
}
