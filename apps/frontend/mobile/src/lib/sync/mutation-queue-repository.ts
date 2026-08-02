import { isRecord } from '@gzclp/domain/type-guards';
import { bootstrapDatabase, getDatabase, requireActiveLocalDataOwner } from '../db/client';

export type MutationPayload = Record<string, unknown>;

export type EnqueueMutationInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: string;
  readonly payload: MutationPayload;
  readonly dedupeKey?: string;
  readonly createdAt?: string;
};

export type QueuedMutation = {
  readonly id: number;
  readonly entityType: string;
  readonly entityId: string;
  readonly operation: string;
  readonly payload: MutationPayload;
  readonly payloadValid?: boolean;
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

function parsePayload(payloadJson: string): {
  readonly payload: MutationPayload;
  readonly payloadValid: boolean;
} {
  try {
    const value: unknown = JSON.parse(payloadJson);
    return isRecord(value)
      ? { payload: value, payloadValid: true }
      : { payload: {}, payloadValid: false };
  } catch {
    return { payload: {}, payloadValid: false };
  }
}

export async function enqueueMutation(input: EnqueueMutationInput): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  const database = getDatabase();
  await bootstrapDatabase(database);

  const createdAt = input.createdAt ?? new Date().toISOString();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (input.dedupeKey) {
      // Replace rather than UPDATE so an in-flight flush holding the old row id
      // cannot acknowledge and accidentally delete the newer desired state.
      await transaction.runAsync(
        'DELETE FROM queued_mutations WHERE owner_user_id = ? AND dedupe_key = ?',
        ownerId,
        input.dedupeKey
      );
      await transaction.runAsync(
        `INSERT INTO queued_mutations
           (owner_user_id, entity_type, entity_id, operation, payload_json, created_at, dedupe_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ownerId,
        input.entityType,
        input.entityId,
        input.operation,
        JSON.stringify(input.payload),
        createdAt,
        input.dedupeKey
      );
      return;
    }

    await transaction.runAsync(
      `INSERT INTO queued_mutations
         (owner_user_id, entity_type, entity_id, operation, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ownerId,
      input.entityType,
      input.entityId,
      input.operation,
      JSON.stringify(input.payload),
      createdAt
    );
  });
}

export async function listQueuedMutations(
  ownerId: string = requireActiveLocalDataOwner()
): Promise<QueuedMutation[]> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  const rows = await database.getAllAsync<QueuedMutationRow>(
    `SELECT id, entity_type, entity_id, operation, payload_json, created_at
     FROM queued_mutations
     WHERE owner_user_id = ?
     ORDER BY created_at ASC, id ASC`,
    ownerId
  );

  return rows.map((row) => {
    const parsed = parsePayload(row.payload_json);
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      payload: parsed.payload,
      ...(parsed.payloadValid ? {} : { payloadValid: false }),
      createdAt: row.created_at,
    };
  });
}

export async function acknowledgeQueuedMutations(
  ids: readonly number[],
  ownerId: string = requireActiveLocalDataOwner()
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const database = getDatabase();
  await bootstrapDatabase(database);

  const placeholders = ids.map(() => '?').join(', ');
  await database.runAsync(
    `DELETE FROM queued_mutations
     WHERE owner_user_id = ? AND id IN (${placeholders})`,
    ownerId,
    ...ids
  );
}

/** Account transitions clear every partition before reassigning ownership. */
export async function clearQueuedMutations(): Promise<void> {
  const database = getDatabase();
  await bootstrapDatabase(database);

  await database.runAsync('DELETE FROM queued_mutations');
}
