interface QueuedMutationRow {
  readonly id: number;
  readonly owner_user_id: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly operation: string;
  readonly payload_json: string;
  readonly created_at: string;
}

const mockRows: QueuedMutationRow[] = [];
let mockNextId = 1;
let mockRowsOverride: unknown[] | null = null;

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
  getDatabase: jest.fn(() => ({
    withExclusiveTransactionAsync: jest.fn(
      async (
        callback: (client: {
          runAsync: (sql: string, ...params: unknown[]) => Promise<unknown>;
        }) => Promise<void>
      ) => {
        await callback({
          runAsync: async (sql: string, ...params: unknown[]) => {
            if (sql.includes('INSERT INTO queued_mutations')) {
              const [ownerUserId, entityType, entityId, operation, payloadJson, createdAt] = params;
              mockRows.push({
                id: mockNextId,
                owner_user_id: String(ownerUserId),
                entity_type: String(entityType),
                entity_id: String(entityId),
                operation: String(operation),
                payload_json: String(payloadJson),
                created_at: String(createdAt),
              });
              mockNextId += 1;
              return { changes: 1, lastInsertRowId: mockNextId - 1 };
            }

            return { changes: 0, lastInsertRowId: 0 };
          },
        });
      }
    ),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('DELETE FROM queued_mutations WHERE owner_user_id = ? AND id IN')) {
        const [ownerUserId, ...ids] = params;
        const idSet = new Set(ids.map((value) => Number(value)));
        const clearedCount = mockRows.filter(
          (row) => row.owner_user_id === ownerUserId && idSet.has(row.id)
        ).length;
        for (let index = mockRows.length - 1; index >= 0; index -= 1) {
          const row = mockRows[index];
          if (row && row.owner_user_id === ownerUserId && idSet.has(row.id)) {
            mockRows.splice(index, 1);
          }
        }
        return { changes: clearedCount, lastInsertRowId: 0 };
      }

      if (sql.includes('DELETE FROM queued_mutations WHERE owner_user_id = ?')) {
        const [ownerUserId] = params;
        const clearedCount = mockRows.filter((row) => row.owner_user_id === ownerUserId).length;
        for (let index = mockRows.length - 1; index >= 0; index -= 1) {
          const row = mockRows[index];
          if (row && row.owner_user_id === ownerUserId) {
            mockRows.splice(index, 1);
          }
        }
        return { changes: clearedCount, lastInsertRowId: 0 };
      }

      return { changes: 0, lastInsertRowId: 0 };
    }),
    getAllAsync: jest.fn(async (sql: string, ownerUserId?: unknown) => {
      if (mockRowsOverride) {
        return mockRowsOverride;
      }

      if (!sql.includes('SELECT id, entity_type, entity_id, operation, payload_json, created_at')) {
        return [];
      }

      return mockRows
        .filter((row) => row.owner_user_id === ownerUserId)
        .sort(
          (left, right) => left.created_at.localeCompare(right.created_at) || left.id - right.id
        );
    }),
    execAsync: jest.fn(async () => undefined),
  })),
}));

import {
  acknowledgeQueuedMutations,
  clearQueuedMutations,
  enqueueMutation,
  listQueuedMutations,
} from './mutation-queue-repository';

describe('mutation queue repository', () => {
  const ownerUserId = 'user-a';
  beforeEach(() => {
    mockRows.length = 0;
    mockNextId = 1;
    mockRowsOverride = null;
  });

  it('stores tracker mutations and returns them in FIFO order', async () => {
    await enqueueMutation({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
      },
      createdAt: '2026-04-20T10:00:00.000Z',
    });
    await enqueueMutation({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'update-metadata',
      payload: {
        metadata: {
          graduationDismissed: true,
        },
      },
      createdAt: '2026-04-20T10:05:00.000Z',
    });

    await expect(listQueuedMutations(ownerUserId)).resolves.toEqual([
      {
        id: 1,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {
          workoutIndex: 0,
          slotId: 'squat-t1',
          result: 'success',
        },
        createdAt: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 2,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'update-metadata',
        payload: {
          metadata: {
            graduationDismissed: true,
          },
        },
        createdAt: '2026-04-20T10:05:00.000Z',
      },
    ]);
  });

  it('acknowledges only the requested queued mutations', async () => {
    await enqueueMutation({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
      },
      createdAt: '2026-04-20T10:00:00.000Z',
    });
    await enqueueMutation({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'update-metadata',
      payload: {
        metadata: {
          graduationDismissed: true,
        },
      },
      createdAt: '2026-04-20T10:05:00.000Z',
    });
    await enqueueMutation({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'delete-result',
      payload: {
        workoutIndex: 1,
        slotId: 'bench-t2',
      },
      createdAt: '2026-04-20T10:06:00.000Z',
    });

    await acknowledgeQueuedMutations(ownerUserId, [1, 2]);

    await expect(listQueuedMutations(ownerUserId)).resolves.toEqual([
      {
        id: 3,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'delete-result',
        payload: {
          workoutIndex: 1,
          slotId: 'bench-t2',
        },
        createdAt: '2026-04-20T10:06:00.000Z',
      },
    ]);
  });

  it('clears all queued mutations', async () => {
    await enqueueMutation({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
      },
      createdAt: '2026-04-20T10:00:00.000Z',
    });
    await enqueueMutation({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'update-metadata',
      payload: {
        metadata: {
          graduationDismissed: true,
        },
      },
      createdAt: '2026-04-20T10:05:00.000Z',
    });

    await clearQueuedMutations(ownerUserId);

    await expect(listQueuedMutations(ownerUserId)).resolves.toEqual([]);
  });

  it('rejects malformed SQLite rows before exposing them to sync', async () => {
    mockRowsOverride = [
      {
        id: 'not-an-integer',
        entity_type: 'program-instance',
        entity_id: 'instance-1',
        operation: 'record-result',
        payload_json: '{}',
        created_at: '2026-04-20T10:00:00.000Z',
      },
    ];

    await expect(listQueuedMutations(ownerUserId)).rejects.toThrow(
      'SQLite returned an invalid queued mutation row'
    );
  });

  it('lists and acknowledges only the current owner queue', async () => {
    await enqueueMutation({
      ownerUserId: 'user-a',
      entityType: 'program-instance',
      entityId: 'instance-a',
      operation: 'record-result',
      payload: { workoutIndex: 0, slotId: 'squat-t1', result: 'success' },
      createdAt: '2026-04-20T10:00:00.000Z',
    });
    await enqueueMutation({
      ownerUserId: 'user-b',
      entityType: 'program-instance',
      entityId: 'instance-b',
      operation: 'record-result',
      payload: { workoutIndex: 0, slotId: 'bench-t1', result: 'success' },
      createdAt: '2026-04-20T10:01:00.000Z',
    });

    await expect(listQueuedMutations('user-b')).resolves.toMatchObject([
      { id: 2, entityId: 'instance-b' },
    ]);
    await acknowledgeQueuedMutations('user-b', [1, 2]);

    await expect(listQueuedMutations('user-a')).resolves.toMatchObject([
      { id: 1, entityId: 'instance-a' },
    ]);
    await expect(listQueuedMutations('user-b')).resolves.toEqual([]);
  });
});
