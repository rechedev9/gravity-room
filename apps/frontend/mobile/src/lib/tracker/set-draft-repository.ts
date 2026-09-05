import { SetLogEntrySchema, type SetLogEntry } from '@gzclp/domain';

import { bootstrapDatabase, getDatabase, requireActiveLocalDataOwner } from '../db/client';

export type SetDrafts = Readonly<Record<string, readonly SetLogEntry[]>>;

interface DraftRow {
  readonly slot_key: string;
  readonly logs_json: string;
}

function validateInstanceId(instanceId: string): void {
  if (instanceId.trim().length === 0) {
    throw new Error('Draft instance id must not be empty');
  }
}

/** Read only the authenticated owner's partition; malformed data is an error. */
export async function getSetDrafts(instanceId: string): Promise<SetDrafts> {
  const ownerId = requireActiveLocalDataOwner();
  validateInstanceId(instanceId);
  const database = getDatabase();
  await bootstrapDatabase(database);
  const rows = await database.getAllAsync<DraftRow>(
    'SELECT slot_key, logs_json FROM set_drafts WHERE owner_user_id = ? AND instance_id = ?',
    ownerId,
    instanceId
  );
  if (requireActiveLocalDataOwner() !== ownerId) {
    throw new Error('Draft owner changed during read');
  }
  return Object.fromEntries(
    rows.map((row) => [row.slot_key, SetLogEntrySchema.array().parse(JSON.parse(row.logs_json))])
  );
}

/**
 * Replace one program's snapshot atomically. Validate and serialize before any
 * await so callers cannot mutate the input during a pending SQLite write.
 * The screen serializes edits and publishes state only after this commits.
 */
export async function saveSetDrafts(instanceId: string, drafts: SetDrafts): Promise<void> {
  const ownerId = requireActiveLocalDataOwner();
  validateInstanceId(instanceId);
  const rows = Object.entries(drafts).map(([key, logs]) => {
    if (!/^\d+:.+$/u.test(key)) {
      throw new Error('Invalid draft slot key');
    }
    return { key, json: JSON.stringify(SetLogEntrySchema.array().parse(logs)) };
  });
  const database = getDatabase();
  await bootstrapDatabase(database);
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (requireActiveLocalDataOwner() !== ownerId) {
      throw new Error('Draft owner changed before write');
    }
    await transaction.runAsync(
      'DELETE FROM set_drafts WHERE owner_user_id = ? AND instance_id = ?',
      ownerId,
      instanceId
    );
    for (const row of rows) {
      await transaction.runAsync(
        'INSERT INTO set_drafts (owner_user_id, instance_id, slot_key, logs_json) VALUES (?, ?, ?, ?)',
        ownerId,
        instanceId,
        row.key,
        row.json
      );
    }
    if (requireActiveLocalDataOwner() !== ownerId) {
      throw new Error('Draft owner changed during write');
    }
  });
}
