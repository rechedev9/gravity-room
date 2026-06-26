/**
 * Results service unit tests — verifies recordResult, deleteResult, and undoLast
 * with mocked DB.
 *
 * Strategy: mock getDb() at module level. The transaction mock executes the
 * callback immediately with a mock `tx` object that supports the Drizzle
 * query-builder chain patterns used by the service.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiError } from '../middleware/error-handler';
import type { ProgramDefinition } from '@gzclp/domain/types/program';

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
  readonly setLogs: unknown;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface UndoEntryRow {
  readonly id: number;
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly previousResult: 'success' | 'fail' | null;
  readonly previousAmrapReps: number | null;
  readonly previousRpe: number | null;
  readonly previousSetLogs: unknown;
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
    setLogs: null,
    completedAt: null,
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
    previousResult: null,
    previousAmrapReps: null,
    previousRpe: null,
    previousSetLogs: null,
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
let programDefinitionResult:
  | { readonly status: 'not_found' }
  | {
      readonly status: 'found';
      readonly definition: ProgramDefinition;
    } = { status: 'not_found' };

function chainable(result: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  obj['where'] = vi.fn(() => chainable(result));
  obj['orderBy'] = vi.fn(() => chainable(result));
  obj['offset'] = vi.fn(() => chainable(result));
  obj['limit'] = vi.fn(() => Promise.resolve(result.slice(0, 1)));
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
    select: vi.fn(function select() {
      return {
        from: vi.fn(function from() {
          const result = selectQueue.shift() ?? [];
          return chainable(result);
        }),
      };
    }),
    insert: vi.fn(function insert() {
      return {
        values: vi.fn(function values() {
          return {
            onConflictDoUpdate: vi.fn(function onConflictDoUpdate() {
              return {
                returning: vi.fn(() => Promise.resolve(insertReturningResult)),
              };
            }),
            returning: vi.fn(() => Promise.resolve(insertReturningResult)),
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
    update: vi.fn(function update() {
      return {
        set: vi.fn(function set() {
          return {
            where: vi.fn(() => Promise.resolve()),
          };
        }),
      };
    }),
    delete: vi.fn(function deleteFn() {
      return {
        where: vi.fn(function where() {
          deletedIds.push('deleted');
          return {
            returning: vi.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
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
    // Raw sql execution — used by trimUndoStack's single-statement DELETE.
    execute: vi.fn(() => Promise.resolve()),
  };
}

function createMockDb(): Record<string, unknown> {
  return {
    transaction: vi.fn(async function transaction(fn: (tx: unknown) => Promise<unknown>) {
      const tx = createMockTx();
      return await fn(tx);
    }),
    // Standalone getDb().select() — used by verifyInstanceOwnership and the
    // undoLast peek now that both run pre-transaction. Consumes the same queue
    // as tx.select() so each test only sees one ordered list of result sets.
    select: vi.fn(function select() {
      return {
        from: vi.fn(function from() {
          const result = selectQueue.shift() ?? [];
          return chainable(result);
        }),
      };
    }),
  };
}

let mockDb = createMockDb();

vi.mock('../db', () => ({
  getDb: () => mockDb,
}));

// Stub getProgramDefinition so getExpectedSlotCount resolves to `undefined`
// without touching the DB queue (template/exercise lookups are out of scope
// for these unit tests; syncCompletedAt no-ops on undefined).
vi.mock('../services/catalog', () => ({
  getProgramDefinition: () => Promise.resolve(programDefinitionResult),
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
  programDefinitionResult = { status: 'not_found' };
  mockDb = createMockDb();
});

const NO_CHANGE_RULE = { type: 'no_change' } as const;
const TEST_DEFINITION: ProgramDefinition = {
  id: 'test-program',
  name: 'Test Program',
  description: '',
  author: 'Gravity Room',
  version: 1,
  category: 'test',
  source: 'preset',
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 't1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 3, reps: 5 }],
          onSuccess: NO_CHANGE_RULE,
          onMidStageFail: NO_CHANGE_RULE,
          onFinalStageFail: NO_CHANGE_RULE,
          startWeightKey: 'squat',
        },
      ],
    },
  ],
  cycleLength: 1,
  totalWorkouts: 1,
  workoutsPerWeek: 1,
  exercises: { squat: { name: 'Squat' } },
  configFields: [],
  weightIncrements: {},
};

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

  it('should reject set-log weights above the service cap with INVALID_DATA', async () => {
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [makeResultRow({ setLogs: [{ reps: 5, weight: 10_001 }] })];

    try {
      await recordResult('user-1', 'inst-1', {
        workoutIndex: 0,
        slotId: 't1',
        result: 'success',
        setLogs: [{ reps: 5, weight: 10_001 }],
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('INVALID_DATA');
      expect(selectQueue.length).toBe(2);
    }
  });

  it('should reject oversized set-log arrays before reading from the database', async () => {
    const setLogs = Array.from({ length: 21 }, () => ({ reps: 5 }));
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [makeResultRow({ setLogs })];

    try {
      await recordResult('user-1', 'inst-1', {
        workoutIndex: 0,
        slotId: 't1',
        result: 'success',
        setLogs,
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('INVALID_DATA');
      expect(selectQueue.length).toBe(2);
    }
  });

  it('should reject malformed set-log entries before reading from the database', async () => {
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [makeResultRow({ setLogs: [{ reps: -1 }] })];

    try {
      await recordResult('user-1', 'inst-1', {
        workoutIndex: 0,
        slotId: 't1',
        result: 'success',
        setLogs: [{ reps: -1 }],
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe('INVALID_DATA');
      expect(selectQueue.length).toBe(2);
    }
  });

  it('should reject oversized workoutIndex before reading from the database', async () => {
    selectQueue = [[{ id: 'inst-1', templateId: 'missing-program' }], []];
    insertReturningResult = [makeResultRow({ workoutIndex: 2000 })];

    try {
      await recordResult('user-1', 'inst-1', {
        workoutIndex: 2000,
        slotId: 't1',
        result: 'success',
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(400);
      expect((err as ApiError).code).toBe('INVALID_DATA');
      expect(selectQueue.length).toBe(2);
    }
  });

  it('should reject negative workoutIndex before reading from the database', async () => {
    selectQueue = [[{ id: 'inst-1', templateId: 'missing-program' }], []];
    insertReturningResult = [makeResultRow({ workoutIndex: -1 })];

    try {
      await recordResult('user-1', 'inst-1', {
        workoutIndex: -1,
        slotId: 't1',
        result: 'success',
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(400);
      expect((err as ApiError).code).toBe('INVALID_DATA');
      expect(selectQueue.length).toBe(2);
    }
  });

  it('should reject oversized slotId before reading from the database', async () => {
    const oversizedSlotId = 's'.repeat(51);
    selectQueue = [[{ id: 'inst-1', templateId: 'missing-program' }], []];
    insertReturningResult = [makeResultRow({ slotId: oversizedSlotId })];

    try {
      await recordResult('user-1', 'inst-1', {
        workoutIndex: 0,
        slotId: oversizedSlotId,
        result: 'success',
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(400);
      expect((err as ApiError).code).toBe('INVALID_DATA');
      expect(selectQueue.length).toBe(2);
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

  it('should record a result with setLogs and return them', async () => {
    const setLogs = [{ reps: 5 }, { reps: 5 }, { reps: 8 }];
    const row = makeResultRow({ setLogs });
    // Queue: 1) verifyInstanceOwnership, 2) existing result check
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [row];

    const result = await recordResult('user-1', 'inst-1', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
      setLogs,
    });

    expect(result.setLogs).toEqual(setLogs);
  });

  it('should record a result without setLogs (backward compat)', async () => {
    const row = makeResultRow();
    // Queue: 1) verifyInstanceOwnership, 2) existing result check
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [row];

    const result = await recordResult('user-1', 'inst-1', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
    });

    expect(result.setLogs).toBeNull();
  });

  it('should reject negative workoutIndex with INVALID_DATA before indexing the program definition', async () => {
    programDefinitionResult = { status: 'found', definition: TEST_DEFINITION };
    selectQueue = [[{ id: 'inst-1', templateId: 'test-program' }]];

    try {
      await deleteResult('user-1', 'inst-1', -1, 't1');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(400);
      expect((err as ApiError).code).toBe('INVALID_DATA');
    }
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

  it('should reject oversized workoutIndex before reading from the database', async () => {
    const existingRow = makeResultRow({ workoutIndex: 2000 });
    selectQueue = [[{ id: 'inst-1', templateId: 'missing-program' }], [existingRow]];

    try {
      await deleteResult('user-1', 'inst-1', 2000, 't1');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(400);
      expect((err as ApiError).code).toBe('INVALID_DATA');
      expect(selectQueue.length).toBe(2);
    }
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
    const undoRow = makeUndoRow({ previousResult: 'fail', previousAmrapReps: 3, previousRpe: 7 });
    // Queue: 1) ownership pre-tx, 2) pre-tx peek for workoutIndex, 3) in-tx pop
    selectQueue = [[{ id: 'inst-1' }], [undoRow], [undoRow]];
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

  it('should pop and restore undo entry with previousSetLogs', async () => {
    const previousSetLogs = [{ reps: 5 }, { reps: 5 }, { reps: 3 }];
    const undoRow = makeUndoRow({ previousResult: 'success', previousSetLogs });
    // Queue: 1) ownership pre-tx, 2) pre-tx peek for workoutIndex, 3) in-tx pop
    selectQueue = [[{ id: 'inst-1' }], [undoRow], [undoRow]];
    insertReturningResult = [];

    const result = await undoLast('user-1', 'inst-1');

    expect(result).not.toBeNull();
    expect(result!.previousSetLogs).toEqual(previousSetLogs);
  });

  it('should pop undo entry with null previousSetLogs (no previous set logs)', async () => {
    const undoRow = makeUndoRow({ previousResult: 'fail', previousSetLogs: null });
    // Queue: 1) ownership pre-tx, 2) pre-tx peek for workoutIndex, 3) in-tx pop
    selectQueue = [[{ id: 'inst-1' }], [undoRow], [undoRow]];
    insertReturningResult = [];

    const result = await undoLast('user-1', 'inst-1');

    expect(result).not.toBeNull();
    expect(result!.previousSetLogs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Transaction scope
// ---------------------------------------------------------------------------

function makeOrderTrackingTx(callOrder: string[]): Record<string, unknown> {
  const tx = createMockTx();
  const originalUpdate = tx['update'] as () => unknown;
  tx['update'] = vi.fn(function update() {
    callOrder.push('touchInstanceTimestamp-called');
    return originalUpdate();
  });
  return tx;
}

describe('recordResult — transaction scope', () => {
  it('calls touchInstanceTimestamp inside the transaction, before commit', async () => {
    const row = makeResultRow();
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [row];

    const callOrder: string[] = [];
    (mockDb as Record<string, unknown>).transaction = vi.fn(async function transaction(
      fn: (tx: unknown) => Promise<unknown>
    ) {
      const tx = makeOrderTrackingTx(callOrder);
      const result = await fn(tx);
      callOrder.push('transaction-committed');
      return result;
    });

    await recordResult('user-1', 'inst-1', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
    });

    expect(callOrder.indexOf('touchInstanceTimestamp-called')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('touchInstanceTimestamp-called')).toBeLessThan(
      callOrder.indexOf('transaction-committed')
    );
  });
});

describe('deleteResult — transaction scope', () => {
  it('calls touchInstanceTimestamp inside the transaction, before commit', async () => {
    const existingRow = makeResultRow();
    selectQueue = [[{ id: 'inst-1' }], [existingRow]];

    const callOrder: string[] = [];
    (mockDb as Record<string, unknown>).transaction = vi.fn(async function transaction(
      fn: (tx: unknown) => Promise<unknown>
    ) {
      const tx = makeOrderTrackingTx(callOrder);
      const result = await fn(tx);
      callOrder.push('transaction-committed');
      return result;
    });

    await deleteResult('user-1', 'inst-1', 0, 't1');

    expect(callOrder.indexOf('touchInstanceTimestamp-called')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('touchInstanceTimestamp-called')).toBeLessThan(
      callOrder.indexOf('transaction-committed')
    );
  });
});

describe('undoLast — transaction scope', () => {
  it('calls touchInstanceTimestamp inside the transaction, before commit', async () => {
    const undoRow = makeUndoRow({ previousResult: 'fail' });
    // Queue: 1) ownership pre-tx, 2) pre-tx peek for workoutIndex, 3) in-tx pop
    selectQueue = [[{ id: 'inst-1' }], [undoRow], [undoRow]];
    insertReturningResult = [];

    const callOrder: string[] = [];
    (mockDb as Record<string, unknown>).transaction = vi.fn(async function transaction(
      fn: (tx: unknown) => Promise<unknown>
    ) {
      const tx = makeOrderTrackingTx(callOrder);
      const result = await fn(tx);
      callOrder.push('transaction-committed');
      return result;
    });

    await undoLast('user-1', 'inst-1');

    expect(callOrder.indexOf('touchInstanceTimestamp-called')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('touchInstanceTimestamp-called')).toBeLessThan(
      callOrder.indexOf('transaction-committed')
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4.3 — syncCompletedAt signature change (REQ-AWP-001)
// ---------------------------------------------------------------------------

describe('syncCompletedAt — new signature', () => {
  it('syncCompletedAt skips gracefully when expectedSlots is undefined (definition not found)', async () => {
    // verifyInstanceOwnership returns templateId=undefined (not in catalog)
    // This makes getExpectedSlotCount return undefined, which is passed to syncCompletedAt
    const row = makeResultRow();
    selectQueue = [[{ id: 'inst-1' }], []];
    insertReturningResult = [row];

    // Should not throw — syncCompletedAt receives undefined and skips
    const result = await recordResult('user-1', 'inst-1', {
      workoutIndex: 0,
      slotId: 't1',
      result: 'success',
    });

    expect(result).toEqual(row);
  });
});

// ---------------------------------------------------------------------------
// Task 4.4 — deleteResult and undoLast pass slot count correctly (REQ-AWP-001)
// ---------------------------------------------------------------------------

describe('deleteResult — passes expectedSlots to syncCompletedAt', () => {
  it('completes successfully when definition is not found (expectedSlots = undefined)', async () => {
    const existingRow = makeResultRow();
    // Queue: 1) verifyInstanceOwnership (no templateId), 2) existing result
    selectQueue = [[{ id: 'inst-1' }], [existingRow]];

    // Should not throw — getExpectedSlotCount returns undefined, syncCompletedAt skips
    await deleteResult('user-1', 'inst-1', 0, 't1');

    expect(deletedIds.length).toBeGreaterThan(0);
  });
});

describe('undoLast — passes expectedSlots to syncCompletedAt', () => {
  it('completes successfully when definition is not found (expectedSlots = undefined)', async () => {
    const undoRow = makeUndoRow({ previousResult: 'fail' });
    // Queue: 1) ownership pre-tx, 2) pre-tx peek for workoutIndex, 3) in-tx pop
    selectQueue = [[{ id: 'inst-1' }], [undoRow], [undoRow]];
    insertReturningResult = [];

    // Should not throw — getExpectedSlotCount returns undefined, syncCompletedAt skips
    const result = await undoLast('user-1', 'inst-1');

    expect(result).toEqual(undoRow);
  });
});
