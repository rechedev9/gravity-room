import { isRecord } from '@gzclp/domain/type-guards';
import {
  bootstrapDatabase,
  getDatabase,
  requireActiveLocalDataOwner,
  type DatabaseClient,
} from '../db/client';

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

export function prepareQueuedMutation(input: EnqueueMutationInput) {
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    operation: input.operation,
    payloadJson: JSON.stringify(input.payload),
    createdAt: input.createdAt ?? new Date().toISOString(),
    dedupeKey: input.dedupeKey ?? null,
  };
}

/** The transaction also belongs to the local snapshot when committing an edit. */
export async function writeQueuedMutation(
  transaction: DatabaseClient,
  ownerId: string,
  input: ReturnType<typeof prepareQueuedMutation>
): Promise<void> {
  if (input.dedupeKey) {
    // A new row ID prevents acknowledgement of an older in-flight snapshot
    // from deleting a newer edit that supersedes it.
    await transaction.runAsync(
      'DELETE FROM queued_mutations WHERE owner_user_id = ? AND dedupe_key = ?',
      ownerId,
      input.dedupeKey
    );
  }
  await transaction.runAsync(
    `INSERT INTO queued_mutations
       (owner_user_id, entity_type, entity_id, operation, payload_json, created_at, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ownerId,
    input.entityType,
    input.entityId,
    input.operation,
    input.payloadJson,
    input.createdAt,
    input.dedupeKey
  );
}

export async function enqueueMutation(input: EnqueueMutationInput): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  const prepared = prepareQueuedMutation(input);
  const database = getDatabase();
  await bootstrapDatabase(database);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Outbox owner changed before write');
    await writeQueuedMutation(transaction, ownerId, prepared);
    if (requireActiveLocalDataOwner() !== ownerId)
      throw new Error('Outbox owner changed during write');
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
