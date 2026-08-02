interface QueuedMutationRow {
  readonly id: number;
  readonly owner_user_id: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly operation: string;
  readonly payload_json: string;
  readonly created_at: string;
  readonly dedupe_key?: string;
}

const mockRows: QueuedMutationRow[] = [];
let mockNextId = 1;
let mockActiveOwnerId = 'user-a';

jest.mock('../db/client', () => ({
  bootstrapDatabase: jest.fn(async () => undefined),
  requireActiveLocalDataOwner: jest.fn(() => mockActiveOwnerId),
  getDatabase: jest.fn(() => ({
    withExclusiveTransactionAsync: jest.fn(
      async (
        callback: (client: {
          runAsync: (sql: string, ...params: unknown[]) => Promise<unknown>;
        }) => Promise<void>
      ) => {
        await callback({
          runAsync: async (sql: string, ...params: unknown[]) => {
            if (sql.includes('DELETE FROM queued_mutations WHERE owner_user_id')) {
              const ownerId = String(params[0]);
              const dedupeKey = String(params[1]);
              for (let index = mockRows.length - 1; index >= 0; index -= 1) {
                if (
                  mockRows[index]?.owner_user_id === ownerId &&
                  mockRows[index]?.dedupe_key === dedupeKey
                ) {
                  mockRows.splice(index, 1);
                }
              }
              return { changes: 1, lastInsertRowId: 0 };
            }

            if (sql.includes('INSERT INTO queued_mutations')) {
              const [ownerId, entityType, entityId, operation, payloadJson, createdAt, dedupeKey] =
                params;
              mockRows.push({
                id: mockNextId,
                owner_user_id: String(ownerId),
                entity_type: String(entityType),
                entity_id: String(entityId),
                operation: String(operation),
                payload_json: String(payloadJson),
                created_at: String(createdAt),
                ...(dedupeKey === undefined ? {} : { dedupe_key: String(dedupeKey) }),
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
      if (sql.trim() === 'DELETE FROM queued_mutations') {
        const clearedCount = mockRows.length;
        mockRows.length = 0;
        return { changes: clearedCount, lastInsertRowId: 0 };
      }

      if (sql.includes('id IN')) {
        const ownerId = String(params[0]);
        const ids = new Set(params.slice(1).map((value) => Number(value)));

        for (let index = mockRows.length - 1; index >= 0; index -= 1) {
          const row = mockRows[index];
          if (row && row.owner_user_id === ownerId && ids.has(row.id)) {
            mockRows.splice(index, 1);
          }
        }

        return { changes: ids.size, lastInsertRowId: 0 };
      }

      return { changes: 0, lastInsertRowId: 0 };
    }),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (!sql.includes('SELECT id, entity_type, entity_id, operation, payload_json, created_at')) {
        return [];
      }

      const ownerId = String(params[0]);
      return mockRows
        .filter((row) => row.owner_user_id === ownerId)
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
  beforeEach(() => {
    mockRows.length = 0;
    mockNextId = 1;
    mockActiveOwnerId = 'user-a';
  });

  it.each([
    { ownerId: 'user-a', expectedEntityId: 'instance-a' },
    { ownerId: 'user-b', expectedEntityId: 'instance-b' },
  ])('lists only queued mutations owned by $ownerId', async ({ ownerId, expectedEntityId }) => {
    mockRows.push(
      {
        id: 1,
        owner_user_id: 'user-a',
        entity_type: 'program-instance',
        entity_id: 'instance-a',
        operation: 'delete-result',
        payload_json: '{"workoutIndex":0,"slotId":"slot-a"}',
        created_at: '2026-04-20T10:00:00.000Z',
      },
      {
        id: 2,
        owner_user_id: 'user-b',
        entity_type: 'program-instance',
        entity_id: 'instance-b',
        operation: 'delete-result',
        payload_json: '{"workoutIndex":0,"slotId":"slot-b"}',
        created_at: '2026-04-20T10:00:00.000Z',
      }
    );
    mockActiveOwnerId = ownerId;

    await expect(listQueuedMutations()).resolves.toEqual([
      expect.objectContaining({ entityId: expectedEntityId }),
    ]);
  });

  it('stores tracker mutations and returns them in FIFO order', async () => {
    await enqueueMutation({
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

    await expect(listQueuedMutations()).resolves.toEqual([
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
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'delete-result',
      payload: {
        workoutIndex: 1,
        slotId: 'bench-t2',
      },
      createdAt: '2026-04-20T10:06:00.000Z',
    });

    await acknowledgeQueuedMutations([1, 2]);

    await expect(listQueuedMutations()).resolves.toEqual([
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

    await clearQueuedMutations();

    await expect(listQueuedMutations()).resolves.toEqual([]);
  });

  it('marks malformed persisted JSON so sync can discard the poison row', async () => {
    mockRows.push({
      id: mockNextId,
      owner_user_id: mockActiveOwnerId,
      entity_type: 'program-instance',
      entity_id: 'instance-1',
      operation: 'record-result',
      payload_json: '{"truncated":',
      created_at: '2026-04-20T10:00:00.000Z',
    });
    mockNextId += 1;

    await expect(listQueuedMutations()).resolves.toEqual([
      {
        id: 1,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'record-result',
        payload: {},
        payloadValid: false,
        createdAt: '2026-04-20T10:00:00.000Z',
      },
    ]);
  });

  it('coalesces pending desired state without reusing an in-flight row id', async () => {
    const dedupeKey = 'program-instance:instance-1:result:0:squat-t1';
    await enqueueMutation({
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: { workoutIndex: 0, slotId: 'squat-t1', result: 'success' },
      dedupeKey,
      createdAt: '2026-04-20T10:00:00.000Z',
    });
    await enqueueMutation({
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'delete-result',
      payload: { workoutIndex: 0, slotId: 'squat-t1' },
      dedupeKey,
      createdAt: '2026-04-20T10:01:00.000Z',
    });

    await expect(listQueuedMutations()).resolves.toEqual([
      {
        id: 2,
        entityType: 'program-instance',
        entityId: 'instance-1',
        operation: 'delete-result',
        payload: { workoutIndex: 0, slotId: 'squat-t1' },
        createdAt: '2026-04-20T10:01:00.000Z',
      },
    ]);
  });
});
