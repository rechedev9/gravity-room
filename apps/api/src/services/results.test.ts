/**
 * Results service unit tests — verifies recordResult, deleteResult, and undoLast
 * with mocked DB.
 *
 * Strategy: mock getDb() at module level. The transaction mock executes the
 * callback immediately with a mock `tx` object that supports the Drizzle
 * query-builder chain patterns used by the service.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ApiError } from '../middleware/error-handler';

// ---------------------------------------------------------------------------
// Types for test fixtures
// ---------------------------------------------------------------------------

interface WorkoutResultRow {
  readonly id: number;
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result: 'success' | 'fail';
  readonly amrapReps: number | null;
  readonly rpe: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface UndoEntryRow {
  readonly id: number;
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly prevResult: 'success' | 'fail' | null;
  readonly prevAmrapReps: number | null;
  readonly prevRpe: number | null;
  readonly createdAt: Date;
}

const NOW = new Date();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeResultRow(overrides: Partial<WorkoutResultRow> = {}): WorkoutResultRow {
  return {
    id: 1,
    instanceId: 'inst-1',
    workoutIndex: 0,
    slotId: 't1',
    result: 'success',
    amrapReps: null,
    rpe: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeUndoRow(overrides: Partial<UndoEntryRow> = {}): UndoEntryRow {
  return {
    id: 1,
    instanceId: 'inst-1',
    workoutIndex: 0,
    slotId: 't1',
    prevResult: null,
    prevAmrapReps: null,
    prevRpe: null,
    createdAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock DB — queue-based with transaction support
// ---------------------------------------------------------------------------

/**
 * selectQueue: each call to .select().from().where().limit(1) or
 * .select().from().where().orderBy().limit(1) or just .select().from()
 * pops the next result set from the queue.
 */
let selectQueue: unknown[][] = [];
let insertReturningResult: unknown[] = [];
let deletedIds: string[] = [];

function chainable(result: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  obj['where'] = mock(() => chainable(result));
  obj['orderBy'] = mock(() => chainable(result));
  obj['offset'] = mock(() => chainable(result));
  obj['limit'] = mock(() => Promise.resolve(result.slice(0, 1)));
  obj['then'] = (fn: (val: unknown[]) => unknown, reject?: (err: unknown) => unknown): unknown => {
    try {
      return Promise.resolve(fn(result));
    } catch (err: unknown) {
      if (reject) return reject(err);
      return Promise.reject(err);
    }
  };
  return obj;
}

function createMockTx(): Record<string, unknown> {
  return {
    select: mock(function select() {
      return {
        from: mock(function from() {
          const result = selectQueue.shift() ?? [];
          return chainable(result);
        }),
      };
    }),
    insert: mock(function insert() {
      return {
        values: mock(function values() {
          return {
            onConflictDoUpdate: mock(function onConflictDoUpdate() {
              return {
                returning: mock(() => Promise.resolve(insertReturningResult)),
              };
            }),
            returning: mock(() => Promise.resolve(insertReturningResult)),
            then: (fn: (val: unknown) => unknown, reject?: (err: unknown) => unknown): unknown => {
              try {
                return Promise.resolve(fn(undefined));
              } catch (err: unknown) {
                if (reject) return reject(err);
                return Promise.reject(err);
              }
            },
          };
        }),
      };
    }),
    update: mock(function update() {
      return {
        set: mock(function set() {
          return {
            where: mock(() => Promise.resolve()),
          };
        }),
      };
    }),
    delete: mock(function deleteFn() {
      return {
        where: mock(function where() {
          deletedIds.push('deleted');
          return Promise.resolve();
        }),
      };
    }),
  };
}

function createMockDb(): Record<string, unknown> {
  return {
    transaction: mock(async function transaction(fn: (tx: unknown) => Promise<unknown>) {
      const tx = createMockTx();
      return await fn(tx);
    }),
    // Support standalone touchInstanceTimestamp outside tx
    update: mock(function update() {
      return {
        set: mock(function set() {
          return {
            where: mock(() => Promise.resolve()),
          };
        }),
      };
    }),
  };
}

let mockDb = createMockDb();

mock.module('../db', () => ({
  getDb: () => mockDb,
}));

// Must import AFTER mock.module
const { recordResult, deleteResult, undoLast } = await import('./results');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  selectQueue = [];
  insertReturningResult = [];
  deletedIds = [];
  mockDb = createMockDb();
});

// ---------------------------------------------------------------------------
// recordResult
// ---------------------------------------------------------------------------

describe('recordResult', () => {
  it('should record a result and return the row', async () => {
    const row = makeResultRow();
    // Queue: 1) verifyInstanceOwnership, 2) existing result check
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [row];

    const result = await recordResult('user-1', 'inst-1', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
    });

    expect(result).toEqual(row);
  });

  it('should reject amrapReps exceeding 99 with INVALID_DATA', async () => {
    try {
      await recordResult('user-1', 'inst-1', {
        workoutIndex: 0,
        slotId: 't1',
        result: 'success',
        amrapReps: 100,
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('INVALID_DATA');
    }
  });

  it('should reject rpe outside 1-10 range with INVALID_DATA', async () => {
    try {
      await recordResult('user-1', 'inst-1', {
        workoutIndex: 0,
        slotId: 't1',
        result: 'success',
        rpe: 11,
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('INVALID_DATA');
    }
  });

  it('should throw 404 when instance is not owned by user', async () => {
    // verifyInstanceOwnership returns empty (no match)
    selectQueue = [[]];

    try {
      await recordResult('user-1', 'inst-999', {
        workoutIndex: 0,
        slotId: 't1',
        result: 'success',
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(404);
    }
  });

  it('should upsert when a result already exists for the same slot', async () => {
    const existingRow = makeResultRow({ result: 'fail' });
    const updatedRow = makeResultRow({ result: 'success', amrapReps: 5 });
    // Queue: 1) verifyInstanceOwnership, 2) existing result found
    selectQueue = [[{ id: 'inst-1' }], [existingRow]];
    insertReturningResult = [updatedRow];

    const result = await recordResult('user-1', 'inst-1', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
      amrapReps: 5,
    });

    expect(result.result).toBe('success');
    expect(result.amrapReps).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// deleteResult
// ---------------------------------------------------------------------------

describe('deleteResult', () => {
  it('should delete an existing result', async () => {
    const existingRow = makeResultRow();
    // Queue: 1) verifyInstanceOwnership, 2) existing result
    selectQueue = [[{ id: 'inst-1' }], [existingRow]];

    await deleteResult('user-1', 'inst-1', 0, 't1');

    expect(deletedIds.length).toBeGreaterThan(0);
  });

  it('should throw 404 when result does not exist', async () => {
    // Queue: 1) verifyInstanceOwnership, 2) no result found
    selectQueue = [[{ id: 'inst-1' }], []];

    try {
      await deleteResult('user-1', 'inst-1', 0, 't1');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('RESULT_NOT_FOUND');
    }
  });

  it('should throw 404 when instance is not owned by user', async () => {
    // verifyInstanceOwnership returns empty
    selectQueue = [[]];

    try {
      await deleteResult('user-1', 'inst-999', 0, 't1');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// undoLast
// ---------------------------------------------------------------------------

describe('undoLast', () => {
  it('should return null when undo stack is empty', async () => {
    // Queue: 1) verifyInstanceOwnership, 2) no undo entries
    selectQueue = [[{ id: 'inst-1' }], []];

    const result = await undoLast('user-1', 'inst-1');

    expect(result).toBeNull();
  });

  it('should pop and restore previous result', async () => {
    const undoRow = makeUndoRow({ prevResult: 'fail', prevAmrapReps: 3, prevRpe: 7 });
    // Queue: 1) verifyInstanceOwnership, 2) undo entry found
    selectQueue = [[{ id: 'inst-1' }], [undoRow]];
    insertReturningResult = [];

    const result = await undoLast('user-1', 'inst-1');

    expect(result).toEqual(undoRow);
  });

  it('should throw 404 when instance is not owned by user', async () => {
    // verifyInstanceOwnership returns empty
    selectQueue = [[]];

    try {
      await undoLast('user-1', 'inst-999');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// Transaction scope — touchInstanceTimestamp runs AFTER the transaction
// ---------------------------------------------------------------------------

describe('recordResult — transaction scope', () => {
  it('calls touchInstanceTimestamp after the transaction resolves, not inside it', async () => {
    const row = makeResultRow();
    // Queue: 1) verifyInstanceOwnership, 2) existing result check
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [row];

    // Track the order of operations
    const callOrder: string[] = [];
    (mockDb as Record<string, unknown>).transaction = mock(async function transaction(
      fn: (tx: unknown) => Promise<unknown>
    ) {
      const tx = createMockTx();
      const result = await fn(tx);
      callOrder.push('transaction-committed');
      return result;
    });
    (mockDb as Record<string, unknown>).update = mock(function update() {
      callOrder.push('touchInstanceTimestamp-called');
      return {
        set: mock(function set() {
          return {
            where: mock(() => Promise.resolve()),
          };
        }),
      };
    });

    await recordResult('user-1', 'inst-1', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
    });

    // Assert: touchInstanceTimestamp called AFTER transaction committed
    expect(callOrder.indexOf('transaction-committed')).toBeLessThan(
      callOrder.indexOf('touchInstanceTimestamp-called')
    );
  });

  it('does not re-throw if touchInstanceTimestamp fails after a successful transaction', async () => {
    const row = makeResultRow();
    // Queue: 1) verifyInstanceOwnership, 2) existing result check
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [row];

    // Make touchInstanceTimestamp fail
    (mockDb as Record<string, unknown>).update = mock(function update() {
      return {
        set: mock(function set() {
          return {
            where: mock(() => Promise.reject(new Error('connection refused'))),
          };
        }),
      };
    });

    // Act — should NOT throw even though touchInstanceTimestamp fails
    const result = await recordResult('user-1', 'inst-1', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
    });

    // Assert — result is still returned successfully
    expect(result).toEqual(row);
  });
});

describe('deleteResult — transaction scope', () => {
  it('calls touchInstanceTimestamp after the transaction resolves', async () => {
    const existingRow = makeResultRow();
    // Queue: 1) verifyInstanceOwnership, 2) existing result
    selectQueue = [[{ id: 'inst-1' }], [existingRow]];

    const callOrder: string[] = [];
    (mockDb as Record<string, unknown>).transaction = mock(async function transaction(
      fn: (tx: unknown) => Promise<unknown>
    ) {
      const tx = createMockTx();
      const result = await fn(tx);
      callOrder.push('transaction-committed');
      return result;
    });
    (mockDb as Record<string, unknown>).update = mock(function update() {
      callOrder.push('touchInstanceTimestamp-called');
      return {
        set: mock(function set() {
          return {
            where: mock(() => Promise.resolve()),
          };
        }),
      };
    });

    await deleteResult('user-1', 'inst-1', 0, 't1');

    // Assert: touchInstanceTimestamp called AFTER transaction committed
    expect(callOrder.indexOf('transaction-committed')).toBeLessThan(
      callOrder.indexOf('touchInstanceTimestamp-called')
    );
  });

  it('does not re-throw if touchInstanceTimestamp fails after deletion', async () => {
    const existingRow = makeResultRow();
    // Queue: 1) verifyInstanceOwnership, 2) existing result
    selectQueue = [[{ id: 'inst-1' }], [existingRow]];

    // Make touchInstanceTimestamp fail
    (mockDb as Record<string, unknown>).update = mock(function update() {
      return {
        set: mock(function set() {
          return {
            where: mock(() => Promise.reject(new Error('connection refused'))),
          };
        }),
      };
    });

    // Act — should NOT throw
    await deleteResult('user-1', 'inst-1', 0, 't1');

    // Assert — no exception was thrown
    expect(true).toBe(true);
  });
});

describe('undoLast — transaction scope', () => {
  it('calls touchInstanceTimestamp after the transaction resolves', async () => {
    const undoRow = makeUndoRow({ prevResult: 'fail' });
    // Queue: 1) verifyInstanceOwnership, 2) undo entry found
    selectQueue = [[{ id: 'inst-1' }], [undoRow]];
    insertReturningResult = [];

    const callOrder: string[] = [];
    (mockDb as Record<string, unknown>).transaction = mock(async function transaction(
      fn: (tx: unknown) => Promise<unknown>
    ) {
      const tx = createMockTx();
      const result = await fn(tx);
      callOrder.push('transaction-committed');
      return result;
    });
    (mockDb as Record<string, unknown>).update = mock(function update() {
      callOrder.push('touchInstanceTimestamp-called');
      return {
        set: mock(function set() {
          return {
            where: mock(() => Promise.resolve()),
          };
        }),
      };
    });

    await undoLast('user-1', 'inst-1');

    // Assert: touchInstanceTimestamp called AFTER transaction committed
    expect(callOrder.indexOf('transaction-committed')).toBeLessThan(
      callOrder.indexOf('touchInstanceTimestamp-called')
    );
  });
});
