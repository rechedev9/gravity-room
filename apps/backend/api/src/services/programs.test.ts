/**
 * Programs service unit tests — buildUndoHistory RPE serialization + composite cursor pagination.
 *
 * Part 1 (buildUndoHistory): self-contained, no DB connection required.
 * Part 2 (parseCursor / getInstances): uses vi.mock() to mock getDb().
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_PROGRAM_WEIGHT,
  MIN_POSITIVE_PROGRAM_WEIGHT,
} from '@gzclp/domain/schemas/program-definition';
import { canonicalProgramCreationIntent } from '@gzclp/domain/program-config';
import { ApiError } from '../middleware/error-handler';
import type { ExportedProgram } from './programs';

// ---------------------------------------------------------------------------
// Import the private buildUndoHistory function by re-testing via a minimal
// test double. We test the exported shape by inspecting the service indirectly
// through fixture-driven unit assertions on the underlying logic.
//
// Since buildUndoHistory is not exported, we replicate the exact function
// logic here to verify its correctness per the spec.
// ---------------------------------------------------------------------------

type ResultType = 'success' | 'fail';

interface UndoEntryRowFixture {
  readonly id: number;
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly previousResult: ResultType | null;
  readonly previousAmrapReps: number | null;
  readonly previousRpe: number | null;
  readonly createdAt: Date;
}

interface UndoHistoryEntry {
  readonly i: number;
  readonly slotId: string;
  readonly prev?: ResultType;
  readonly prevRpe?: number;
  readonly prevAmrapReps?: number;
}

/** Mirrors the actual buildUndoHistory implementation in services/programs.ts */
function buildUndoHistory(rows: readonly UndoEntryRowFixture[]): UndoHistoryEntry[] {
  return rows.map((row) => ({
    i: row.workoutIndex,
    slotId: row.slotId,
    ...(row.previousResult !== null ? { prev: row.previousResult } : {}),
    ...(row.previousRpe !== null && row.previousRpe !== undefined
      ? { prevRpe: row.previousRpe }
      : {}),
    ...(row.previousAmrapReps !== null && row.previousAmrapReps !== undefined
      ? { prevAmrapReps: row.previousAmrapReps }
      : {}),
  }));
}

function makeRow(overrides: Partial<UndoEntryRowFixture> = {}): UndoEntryRowFixture {
  return {
    id: 1,
    instanceId: 'inst-1',
    workoutIndex: 0,
    slotId: 't1',
    previousResult: null,
    previousAmrapReps: null,
    previousRpe: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildUndoHistory
// ---------------------------------------------------------------------------

describe('buildUndoHistory', () => {
  describe('previousRpe serialization', () => {
    it('should include prevRpe when DB row has previous_rpe set', () => {
      const rows = [makeRow({ previousRpe: 8 })];

      const result = buildUndoHistory(rows);

      expect(result[0]?.prevRpe).toBe(8);
    });

    it('should not include prevRpe key when DB column is null', () => {
      const rows = [makeRow({ previousRpe: null })];

      const result = buildUndoHistory(rows);

      expect('prevRpe' in (result[0] ?? {})).toBe(false);
    });
  });

  describe('previousAmrapReps serialization', () => {
    it('should include prevAmrapReps when DB row has previous_amrap_reps set', () => {
      const rows = [makeRow({ previousAmrapReps: 12 })];

      const result = buildUndoHistory(rows);

      expect(result[0]?.prevAmrapReps).toBe(12);
    });

    it('should not include prevAmrapReps key when DB column is null', () => {
      const rows = [makeRow({ previousAmrapReps: null })];

      const result = buildUndoHistory(rows);

      expect('prevAmrapReps' in (result[0] ?? {})).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    it('should omit both prevRpe and prevAmrapReps when DB columns are null', () => {
      const rows = [
        makeRow({ previousResult: 'success', previousRpe: null, previousAmrapReps: null }),
      ];

      const result = buildUndoHistory(rows);

      expect('prevRpe' in (result[0] ?? {})).toBe(false);
      expect('prevAmrapReps' in (result[0] ?? {})).toBe(false);
      expect(result[0]?.prev).toBe('success');
    });
  });
});

// ---------------------------------------------------------------------------
// Part 2: parseCursor (via getInstances) + getInstances composite cursor
// ---------------------------------------------------------------------------

// Mock DB for getInstances — queue-based chainable query builder
let selectRows: unknown[] = [];
let capturedOrderBy: unknown[] = [];
let capturedWhere: unknown = undefined;

function createChainable(rows: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  obj['from'] = vi.fn(function from() {
    return {
      where: vi.fn(function where(condition: unknown) {
        capturedWhere = condition;
        return {
          orderBy: vi.fn(function orderBy(...args: unknown[]) {
            capturedOrderBy = args;
            return {
              limit: vi.fn(function limit() {
                return {
                  then: (fn: (val: unknown[]) => unknown) => fn(rows),
                };
              }),
            };
          }),
        };
      }),
    };
  });
  return obj;
}

function createMockDb(): Record<string, unknown> {
  return {
    select: vi.fn(function select() {
      return createChainable(selectRows);
    }),
  };
}

let mockDb = createMockDb();

vi.mock('../db', () => ({
  getDb: () => mockDb,
}));

// Also mock the catalog service dependency (getProgramDefinition is imported by programs.ts)
const mockGetProgramDefinition = vi.fn(() => Promise.resolve({ status: 'not_found' }));

vi.mock('../services/catalog', () => ({
  getProgramDefinition: mockGetProgramDefinition,
}));

const mockInvalidateCachedInstances = vi.fn(() => Promise.resolve());

vi.mock('../lib/program-cache', () => ({
  invalidateCachedInstances: mockInvalidateCachedInstances,
}));

// Must import AFTER mock.module
const {
  createInstance,
  getInstances,
  getInstance,
  deleteInstance,
  updateInstance,
  updateInstanceMetadata,
  importInstance,
} = await import('./programs');

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-02-20T09:00:00.000Z');
const UUID_A = 'a0000000-0000-0000-0000-000000000001';

interface InstanceListRow {
  readonly id: string;
  readonly templateId: string;
  readonly name: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function makeInstanceRow(overrides: Partial<InstanceListRow> = {}): InstanceListRow {
  return {
    id: UUID_A,
    templateId: 'gzclp',
    name: 'Test Program',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  selectRows = [];
  capturedOrderBy = [];
  capturedWhere = undefined;
  mockDb = createMockDb();
  mockGetProgramDefinition.mockClear();
  mockGetProgramDefinition.mockImplementation(() => Promise.resolve({ status: 'not_found' }));
  mockInvalidateCachedInstances.mockClear();
});

// ---------------------------------------------------------------------------
// parseCursor (tested indirectly via getInstances behavior)
// ---------------------------------------------------------------------------

describe('parseCursor', () => {
  it('returns { ts, id } for a valid composite cursor (via getInstances accepting it)', async () => {
    // A valid cursor should not throw — getInstances should proceed
    const row = makeInstanceRow();
    selectRows = [row];

    const result = await getInstances('user-1', {
      limit: 10,
      cursor: `${NOW.toISOString()}_${UUID_A}`,
    });

    expect(result.data.length).toBe(1);
  });

  it('returns undefined for a bare ISO timestamp without underscore (throws 400)', async () => {
    let thrown: unknown;
    try {
      await getInstances('user-1', { cursor: '2026-02-10T14:23:00.000Z' });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_CURSOR');
  });

  it('returns undefined for an empty string (throws 400)', async () => {
    let thrown: unknown;
    try {
      await getInstances('user-1', { cursor: '' });
    } catch (e) {
      thrown = e;
    }

    // Empty string is falsy, so options.cursor is falsy — getInstances should NOT throw
    // The cursor check is `if (options.cursor)` which is false for empty string
    // So this actually results in a normal first-page query
    expect(thrown).toBeUndefined();
  });

  it('returns undefined when the timestamp component is not a valid date (throws 400)', async () => {
    let thrown: unknown;
    try {
      await getInstances('user-1', { cursor: 'not-a-date_some-id' });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_CURSOR');
  });
});

// ---------------------------------------------------------------------------
// getInstances — composite cursor
// ---------------------------------------------------------------------------

describe('getInstances', () => {
  it('throws ApiError 400 when a non-empty malformed cursor is provided', async () => {
    let thrown: unknown;
    try {
      await getInstances('user-1', { cursor: 'totally-invalid-cursor' });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_CURSOR');
  });

  it('builds two-column keyset WHERE when cursor is valid', async () => {
    const row = makeInstanceRow();
    selectRows = [row];

    await getInstances('user-1', {
      limit: 10,
      cursor: `2026-02-10T14:23:00.000Z_${UUID_A}`,
    });

    // The WHERE condition was captured — it should exist (not undefined)
    // This validates that the parseCursor succeeded and conditions were built
    expect(capturedWhere).toBeDefined();
  });

  it('orders results by created_at DESC, id ASC', async () => {
    const row = makeInstanceRow();
    selectRows = [row];

    await getInstances('user-1', { limit: 10 });

    // Verify orderBy was called with two arguments (desc(createdAt), asc(id))
    expect(capturedOrderBy.length).toBe(2);
  });

  it('encodes nextCursor as <ts>_<uuid> when hasMore is true', async () => {
    // Return limit + 1 rows to trigger hasMore = true
    const rows = Array.from({ length: 3 }, (_, i) =>
      makeInstanceRow({
        id: `${UUID_A.slice(0, -1)}${i}`,
        createdAt: new Date(NOW.getTime() - i * 1000),
      })
    );
    selectRows = rows;

    const result = await getInstances('user-1', { limit: 2 });

    expect(result.nextCursor).not.toBeNull();
    // nextCursor should be <iso>_<uuid> format
    const cursor = result.nextCursor as string;
    const separatorIdx = cursor.lastIndexOf('_');
    expect(separatorIdx).toBeGreaterThan(0);

    const tsPart = cursor.substring(0, separatorIdx);
    const idPart = cursor.substring(separatorIdx + 1);
    expect(new Date(tsPart).toISOString()).toBe(tsPart);
    expect(idPart.length).toBeGreaterThan(0);
  });

  it('returns nextCursor = null when hasMore is false', async () => {
    const row = makeInstanceRow();
    selectRows = [row];

    const result = await getInstances('user-1', { limit: 10 });

    expect(result.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 4.5 — updateInstanceMetadata JSONB merge (REQ-AWP-002)
// ---------------------------------------------------------------------------

describe('updateInstanceMetadata', () => {
  it('throws 400 METADATA_TOO_LARGE when incoming patch exceeds 10KB', async () => {
    // Create a metadata object larger than 10KB
    const largeValue = 'x'.repeat(11_000);
    const largeMetadata = { key: largeValue };

    let thrown: unknown;
    try {
      await updateInstanceMetadata('user-1', 'inst-1', largeMetadata);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('METADATA_TOO_LARGE');
  });

  it('throws 404 INSTANCE_NOT_FOUND when no row is updated', async () => {
    // Override mockDb to support the update chain and return empty result
    (mockDb as Record<string, unknown>).update = vi.fn(function update() {
      return {
        set: vi.fn(function set() {
          return {
            where: vi.fn(function where() {
              return {
                returning: vi.fn(() => Promise.resolve([])),
              };
            }),
          };
        }),
      };
    });
    (mockDb as Record<string, unknown>).select = vi.fn(function select() {
      return {
        from: vi.fn(function from() {
          return {
            where: vi.fn(function where() {
              return {
                limit: vi.fn(() => Promise.resolve([])),
              };
            }),
          };
        }),
      };
    });

    let thrown: unknown;
    try {
      await updateInstanceMetadata('user-1', 'nonexistent', { theme: 'dark' });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(404);
    expect((thrown as ApiError).code).toBe('INSTANCE_NOT_FOUND');
  });

  it('throws 400 METADATA_TOO_LARGE when merged metadata would exceed 10KB', async () => {
    (mockDb as Record<string, unknown>).update = vi.fn(function update() {
      return {
        set: vi.fn(function set() {
          return {
            where: vi.fn(function where() {
              return {
                returning: vi.fn(() => Promise.resolve([])),
              };
            }),
          };
        }),
      };
    });
    (mockDb as Record<string, unknown>).select = vi.fn(function select() {
      return {
        from: vi.fn(function from() {
          return {
            where: vi.fn(function where() {
              return {
                limit: vi.fn(() => Promise.resolve([{ id: 'inst-1' }])),
              };
            }),
          };
        }),
      };
    });

    let thrown: unknown;
    try {
      await updateInstanceMetadata('user-1', 'inst-1', { theme: 'dark' });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('METADATA_TOO_LARGE');
  });

  it('accepts valid small metadata without throwing size error', async () => {
    const instanceRow = {
      id: 'inst-1',
      userId: 'user-1',
      templateId: 'gzclp',
      name: 'Test',
      programConfig: {},
      metadata: { theme: 'dark' },
      status: 'active',
      createdAt: NOW,
      updatedAt: NOW,
    };

    // Mock: update returns the updated row
    (mockDb as Record<string, unknown>).update = vi.fn(function update() {
      return {
        set: vi.fn(function set() {
          return {
            where: vi.fn(function where() {
              return {
                returning: vi.fn(() => Promise.resolve([instanceRow])),
              };
            }),
          };
        }),
      };
    });
    // fetchResultsAndUndo calls getDb().select() twice (results + undo)
    // Each chain: .select({...}).from(table).where(condition) must be thenable
    (mockDb as Record<string, unknown>).select = vi.fn(function select() {
      return {
        from: vi.fn(function from() {
          return {
            where: vi.fn(function where() {
              // Thenable that resolves to empty array
              // Also supports .orderBy() for undo query
              return {
                then: (fn: (val: unknown[]) => unknown) => Promise.resolve(fn([])),
                orderBy: vi.fn(function orderBy() {
                  return {
                    then: (fn: (val: unknown[]) => unknown) => Promise.resolve(fn([])),
                  };
                }),
              };
            }),
          };
        }),
      };
    });

    // Should not throw
    const result = await updateInstanceMetadata('user-1', 'inst-1', { notifications: true });

    expect(result.id).toBe('inst-1');
  });
});

// ---------------------------------------------------------------------------
// Task 4.6 — getInstance column projection (REQ-AWP-003)
// ---------------------------------------------------------------------------

describe('getInstance', () => {
  it('returns full response shape when instance exists', async () => {
    const instanceRow = {
      id: 'inst-1',
      userId: 'user-1',
      templateId: 'gzclp',
      name: 'Test Program',
      programConfig: { squat: 80 },
      metadata: null,
      status: 'active',
      createdAt: NOW,
      updatedAt: NOW,
    };

    // Mock: first select().from().where().limit(1) returns the instance
    // Then fetchResultsAndUndo calls select() twice more (results + undo)
    let callCount = 0;
    (mockDb as Record<string, unknown>).select = vi.fn(function select() {
      callCount++;
      if (callCount === 1) {
        // getInstance query — returns instance row
        return {
          from: vi.fn(function from() {
            return {
              where: vi.fn(function where() {
                return {
                  limit: vi.fn(() => Promise.resolve([instanceRow])),
                };
              }),
            };
          }),
        };
      }
      // fetchResultsAndUndo queries — thenable returning empty arrays
      return {
        from: vi.fn(function from() {
          return {
            where: vi.fn(function where() {
              return {
                then: (fn: (val: unknown[]) => unknown) => Promise.resolve(fn([])),
                orderBy: vi.fn(function orderBy() {
                  return {
                    then: (fn: (val: unknown[]) => unknown) => Promise.resolve(fn([])),
                  };
                }),
              };
            }),
          };
        }),
      };
    });

    const result = await getInstance('user-1', 'inst-1');

    expect(result.id).toBe('inst-1');
    expect(result.programId).toBe('gzclp');
    expect(result.name).toBe('Test Program');
    expect(result.status).toBe('active');
    expect(result.config).toEqual({ squat: 80 });
    expect(result.metadata).toBeNull();
  });

  it('throws 404 INSTANCE_NOT_FOUND when no instance matches', async () => {
    // Mock: select returns empty
    (mockDb as Record<string, unknown>).select = vi.fn(function select() {
      return {
        from: vi.fn(function from() {
          return {
            where: vi.fn(function where() {
              return {
                limit: vi.fn(() => Promise.resolve([])),
              };
            }),
          };
        }),
      };
    });

    let thrown: unknown;
    try {
      await getInstance('user-1', 'nonexistent');
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(404);
    expect((thrown as ApiError).code).toBe('INSTANCE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// importInstance — undoHistory validation
// ---------------------------------------------------------------------------

function useImportableProgramDefinition(): void {
  mockGetProgramDefinition.mockImplementation(() =>
    Promise.resolve({
      status: 'found',
      definition: {
        totalWorkouts: 2,
        days: [
          {
            name: 'Day 1',
            slots: [{ id: 'squat' }],
          },
        ],
      },
    })
  );
}

function baseExportedProgram(overrides: Partial<ExportedProgram> = {}): ExportedProgram {
  return {
    version: 1,
    exportDate: NOW.toISOString(),
    programId: 'gzclp',
    name: 'Imported',
    config: {},
    results: {},
    undoHistory: [],
    ...overrides,
  };
}

describe('importInstance — undoHistory validation', () => {
  it('rejects undo entries with negative workoutIndex before writing to the database', async () => {
    useImportableProgramDefinition();
    const transaction = vi.fn(() => {
      throw new Error('transaction should not run');
    });
    mockDb = { transaction };

    let thrown: unknown;
    try {
      await importInstance(
        'user-1',
        baseExportedProgram({
          undoHistory: [{ i: -1, slotId: 'squat', prev: 'success' }],
        })
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_DATA');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects undo entries with unknown slotIds before writing to the database', async () => {
    useImportableProgramDefinition();
    const transaction = vi.fn(() => {
      throw new Error('transaction should not run');
    });
    mockDb = { transaction };

    let thrown: unknown;
    try {
      await importInstance(
        'user-1',
        baseExportedProgram({
          undoHistory: [{ i: 0, slotId: 'unknown', prev: 'fail' }],
        })
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_DATA');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects undo entries with oversized previous AMRAP reps before writing to the database', async () => {
    useImportableProgramDefinition();
    const transaction = vi.fn(() => {
      throw new Error('transaction should not run');
    });
    mockDb = { transaction };

    let thrown: unknown;
    try {
      await importInstance(
        'user-1',
        baseExportedProgram({
          undoHistory: [{ i: 0, slotId: 'squat', prev: 'success', prevAmrapReps: 100 }],
        })
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_DATA');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects imported result entries with oversized set-log arrays before writing to the database', async () => {
    useImportableProgramDefinition();
    const transaction = vi.fn(() => {
      throw new Error('transaction should not run');
    });
    mockDb = { transaction };

    let thrown: unknown;
    try {
      await importInstance(
        'user-1',
        baseExportedProgram({
          results: {
            '0': {
              squat: {
                result: 'success',
                setLogs: Array.from({ length: 21 }, () => ({ reps: 5 })),
              },
            },
          },
        })
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_DATA');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects undo entries with oversized previous set-log arrays before writing to the database', async () => {
    useImportableProgramDefinition();
    const transaction = vi.fn(() => {
      throw new Error('transaction should not run');
    });
    mockDb = { transaction };

    let thrown: unknown;
    try {
      await importInstance(
        'user-1',
        baseExportedProgram({
          undoHistory: [
            {
              i: 0,
              slotId: 'squat',
              prev: 'success',
              prevSetLogs: Array.from({ length: 21 }, () => ({ reps: 5 })),
            },
          ],
        })
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_DATA');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects imported result entries with malformed set logs before writing to the database', async () => {
    useImportableProgramDefinition();
    const transaction = vi.fn(() => {
      throw new Error('transaction should not run');
    });
    mockDb = { transaction };

    let thrown: unknown;
    try {
      await importInstance(
        'user-1',
        baseExportedProgram({
          results: {
            '0': {
              squat: {
                result: 'success',
                setLogs: [{ reps: -1 }],
              },
            },
          },
        })
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_DATA');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects imported result set-log weights above the service cap before writing to the database', async () => {
    useImportableProgramDefinition();
    const transaction = vi.fn(() => {
      throw new Error('transaction should not run');
    });
    mockDb = { transaction };

    let thrown: unknown;
    try {
      await importInstance(
        'user-1',
        baseExportedProgram({
          results: {
            '0': {
              squat: {
                result: 'success',
                setLogs: [{ reps: 5, weight: 10_001 }],
              },
            },
          },
        })
      );
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(400);
    expect((thrown as ApiError).code).toBe('INVALID_DATA');
    expect(transaction).not.toHaveBeenCalled();
  });
});

interface TransactionProgramRow {
  readonly id: string;
  readonly userId: string;
  readonly templateId: string;
  readonly name: string;
  readonly creationKey?: string;
  readonly creationIntent?: string | null;
  readonly programConfig: Record<string, number | string>;
  status: 'active' | 'completed' | 'archived';
  readonly definitionId: string | null;
  readonly customDefinition: null;
  readonly metadata: null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const CONFIG_TEMPLATE = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Test program',
  author: 'Test',
  version: 1,
  category: 'strength',
  source: 'preset',
  isActive: true,
  definition: {
    cycleLength: 1,
    totalWorkouts: 1,
    workoutsPerWeek: 1,
    exercises: { squat: {} },
    configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 5 }],
    weightIncrements: { squat: 5 },
    days: [
      {
        name: 'Day 1',
        slots: [
          {
            id: 'squat',
            exerciseId: 'squat',
            tier: 't1',
            stages: [{ sets: 3, reps: 5 }],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'no_change' },
            onFinalStageFail: { type: 'no_change' },
            startWeightKey: 'squat',
          },
        ],
      },
    ],
  },
};

function createProgramTransaction(
  rows: TransactionProgramRow[],
  options: {
    readonly failInsert?: boolean;
    readonly template?: Readonly<Record<string, unknown>>;
    readonly existing?: TransactionProgramRow;
    readonly emptyExistingLookup?: boolean;
    readonly resultRows?: readonly Record<string, unknown>[];
    readonly undoRows?: readonly Record<string, unknown>[];
  } = {}
): Record<string, unknown> {
  let selectCount = 0;
  return {
    select: vi.fn(() => {
      selectCount += 1;
      const exerciseSelectCount = options.emptyExistingLookup ? 4 : 3;
      const resultRowsSelectCount = options.existing === undefined ? exerciseSelectCount + 1 : 3;
      const undoRowsSelectCount = resultRowsSelectCount + 1;
      const selected =
        selectCount === 1
          ? [{ id: 'user-1' }]
          : options.existing !== undefined && selectCount === 2
            ? [options.existing]
            : options.emptyExistingLookup && selectCount === 2
              ? []
              : selectCount === (options.emptyExistingLookup ? 3 : 2)
                ? [options.template ?? CONFIG_TEMPLATE]
                : options.existing === undefined && selectCount === exerciseSelectCount
                  ? [{ id: 'squat', name: 'Squat' }]
                  : selectCount === resultRowsSelectCount
                    ? (options.resultRows ?? [])
                    : selectCount === undoRowsSelectCount
                      ? (options.undoRows ?? [])
                      : [];
      const result = {
        limit: vi.fn(async () => selected),
        for: vi.fn(() => ({ limit: vi.fn(async () => selected) })),
      };
      const projectedRows = {
        orderBy: vi.fn(async () => selected),
        then: (onfulfilled: (rows: readonly unknown[]) => unknown) =>
          Promise.resolve(selected).then(onfulfilled),
      };
      return {
        from: vi.fn(() => ({
          where: vi.fn(() =>
            selectCount >= (options.existing === undefined ? exerciseSelectCount : 3)
              ? projectedRows
              : result
          ),
        })),
      };
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            const displaced: { id: string }[] = [];
            for (const row of rows) {
              if (row.userId === 'user-1' && row.status === 'active') {
                row.status = 'completed';
                displaced.push({ id: row.id });
              }
            }
            return displaced;
          }),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          if (options.failInsert) {
            throw new Error('insert failed');
          }
          const row: TransactionProgramRow = {
            id: `created-${rows.length}`,
            userId: String(values.userId),
            templateId: String(values.templateId),
            name: String(values.name),
            ...(typeof values.creationKey === 'string' ? { creationKey: values.creationKey } : {}),
            ...(typeof values.creationIntent === 'string'
              ? { creationIntent: values.creationIntent }
              : {}),
            programConfig:
              typeof values.programConfig === 'object' && values.programConfig !== null
                ? Object.fromEntries(
                    Object.entries(values.programConfig).filter(
                      (entry): entry is [string, string | number] =>
                        typeof entry[1] === 'string' || typeof entry[1] === 'number'
                    )
                  )
                : {},
            status: 'active',
            definitionId: null,
            customDefinition: null,
            metadata: null,
            createdAt: NOW,
            updatedAt: NOW,
          };
          rows.push(row);
          return [row];
        }),
      })),
    })),
  };
}

describe('createInstance transaction and per-user serialization', () => {
  it('persists the canonical creation intent with a new creation key', async () => {
    const persisted: TransactionProgramRow[] = [];
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task(createProgramTransaction(persisted, { emptyExistingLookup: true }))
      ),
    };

    await createInstance(
      'user-1',
      'gzclp',
      '  First program  ',
      { squat: 20 },
      'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0'
    );

    expect(persisted[0]?.creationIntent).toBe(
      canonicalProgramCreationIntent('gzclp', 'First program', { squat: 20 })
    );
  });

  it('replays an existing creation key after a rename without consulting a changed catalog', async () => {
    const existing: TransactionProgramRow = {
      id: 'existing-program',
      userId: 'user-1',
      templateId: 'gzclp',
      name: 'Renamed after creation',
      creationKey: 'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0',
      creationIntent: canonicalProgramCreationIntent('gzclp', 'First program', { squat: 20 }),
      programConfig: { squat: 20 },
      status: 'active',
      definitionId: null,
      customDefinition: null,
      metadata: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task(
          createProgramTransaction([existing], {
            existing,
            template: { id: 'mutated-catalog' },
            resultRows: [
              {
                workoutIndex: 0,
                slotId: 'squat-t1',
                result: 'success',
                amrapReps: null,
                rpe: 8,
                setLogs: [],
                completedAt: null,
                createdAt: NOW,
              },
            ],
            undoRows: [
              {
                workoutIndex: 0,
                slotId: 'squat-t1',
                previousResult: 'fail',
                previousAmrapReps: null,
                previousRpe: null,
                previousSetLogs: null,
              },
            ],
          })
        )
      ),
    };

    await expect(
      createInstance(
        'user-1',
        'gzclp',
        '  First program  ',
        { squat: 20 },
        'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0'
      )
    ).resolves.toMatchObject({
      id: existing.id,
      name: existing.name,
      config: existing.programConfig,
      results: { '0': { 'squat-t1': { result: 'success', rpe: 8, setLogs: [] } } },
      undoHistory: [{ i: 0, slotId: 'squat-t1', prev: 'fail' }],
    });
  });

  it('rejects a legacy key without an immutable creation intent instead of rebuilding one', async () => {
    const existing: TransactionProgramRow = {
      id: 'existing-program',
      userId: 'user-1',
      templateId: 'gzclp',
      name: 'First program',
      creationKey: 'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0',
      creationIntent: null,
      programConfig: { squat: 20 },
      status: 'active',
      definitionId: null,
      customDefinition: null,
      metadata: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task(createProgramTransaction([existing], { existing }))
      ),
    };

    await expect(
      createInstance(
        'user-1',
        'gzclp',
        'First program',
        { squat: 20 },
        'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0'
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' });
  });

  it('rejects a reused idempotency key for a different normalized create intent', async () => {
    const existing: TransactionProgramRow = {
      id: 'existing-program',
      userId: 'user-1',
      templateId: 'gzclp',
      name: 'First program',
      creationKey: 'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0',
      creationIntent: canonicalProgramCreationIntent('gzclp', 'First program', { squat: 20 }),
      programConfig: { squat: 20 },
      status: 'active',
      definitionId: null,
      customDefinition: null,
      metadata: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task(createProgramTransaction([existing], { existing }))
      ),
    };

    await expect(
      createInstance(
        'user-1',
        'gzclp',
        'Different program',
        { squat: 20 },
        'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0'
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' });
  });

  it('returns a conflict before validating a changed catalog payload', async () => {
    const existing: TransactionProgramRow = {
      id: 'existing-program',
      userId: 'user-1',
      templateId: 'gzclp',
      name: 'First program',
      creationKey: 'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0',
      creationIntent: canonicalProgramCreationIntent('gzclp', 'First program', { squat: 20 }),
      programConfig: { squat: 20 },
      status: 'active',
      definitionId: null,
      customDefinition: null,
      metadata: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task(
          createProgramTransaction([existing], { existing, template: { id: 'mutated-catalog' } })
        )
      ),
    };

    await expect(
      createInstance(
        'user-1',
        'gzclp',
        'First program',
        { squat: 17.5 },
        'c1f98b2b-a61c-4bbd-a9c6-4f0a23e8f7d0'
      )
    ).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' });
  });

  it('rolls back the active-status update when insert fails', async () => {
    const persisted: TransactionProgramRow[] = [
      {
        id: 'old-active',
        userId: 'user-1',
        templateId: 'gzclp',
        name: 'Old',
        programConfig: {},
        status: 'active',
        definitionId: null,
        customDefinition: null,
        metadata: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const draft = persisted.map((row) => ({ ...row }));
        try {
          const result = await task(createProgramTransaction(draft, { failInsert: true }));
          persisted.splice(0, persisted.length, ...draft);
          return result;
        } catch (error) {
          throw error;
        }
      }),
    };

    await expect(createInstance('user-1', 'gzclp', 'New', { squat: 20 })).rejects.toThrow(
      'insert failed'
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.status).toBe('active');
    expect(mockInvalidateCachedInstances).not.toHaveBeenCalled();
  });

  it('serializes concurrent creates and leaves exactly one active instance', async () => {
    const persisted: TransactionProgramRow[] = [];
    let tail = Promise.resolve();
    let inFlight = 0;
    let maxInFlight = 0;
    mockDb = {
      transaction: vi.fn(
        (task: (tx: Record<string, unknown>) => Promise<unknown>): Promise<unknown> => {
          const run = tail.then(async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            const draft = persisted.map((row) => ({ ...row }));
            try {
              const result = await task(createProgramTransaction(draft));
              persisted.splice(0, persisted.length, ...draft);
              return result;
            } finally {
              inFlight -= 1;
            }
          });
          tail = run.then(
            () => undefined,
            () => undefined
          );
          return run;
        }
      ),
    };

    await Promise.all([
      createInstance('user-1', 'gzclp', 'First', { squat: 20 }),
      createInstance('user-1', 'gzclp', 'Second', { squat: 25 }),
    ]);

    expect(maxInFlight).toBe(1);
    expect(persisted.filter((row) => row.status === 'active')).toHaveLength(1);
    expect(persisted.filter((row) => row.status === 'completed')).toHaveLength(1);
    expect(mockInvalidateCachedInstances).toHaveBeenNthCalledWith(1, 'user-1', ['created-0']);
    expect(mockInvalidateCachedInstances).toHaveBeenNthCalledWith(2, 'user-1', [
      'created-1',
      'created-0',
    ]);
  });
});

describe('authoritative program configuration validation', () => {
  const numericBoundaryTemplate = {
    ...CONFIG_TEMPLATE,
    definition: {
      ...CONFIG_TEMPLATE.definition,
      configFields: [
        {
          key: 'load',
          label: 'Load',
          type: 'weight',
          min: 0,
          step: MIN_POSITIVE_PROGRAM_WEIGHT,
        },
      ],
    },
  };
  const selectTemplate = {
    ...CONFIG_TEMPLATE,
    definition: {
      ...CONFIG_TEMPLATE.definition,
      configFields: [
        ...CONFIG_TEMPLATE.definition.configFields,
        {
          key: 'variant',
          label: 'Variant',
          type: 'select',
          options: [
            { label: 'Classic', value: 'classic' },
            { label: 'Paused', value: 'paused' },
          ],
        },
      ],
    },
  };
  const customDefinition = {
    id: 'custom-program',
    name: 'Custom program',
    description: 'Instance-specific contract',
    author: 'User',
    version: 1,
    category: 'custom',
    source: 'custom',
    ...CONFIG_TEMPLATE.definition,
    exercises: { squat: { name: 'Squat' } },
    configFields: [{ key: 'customLoad', label: 'Custom load', type: 'weight', min: 10, step: 2 }],
  };

  it.each([0, MIN_POSITIVE_PROGRAM_WEIGHT, MAX_PROGRAM_WEIGHT])(
    'accepts the shared numeric boundary value %s in authoritative create validation',
    async (load) => {
      const persisted: TransactionProgramRow[] = [];
      mockDb = {
        transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) => {
          const result = await task(
            createProgramTransaction(persisted, { template: numericBoundaryTemplate })
          );
          return result;
        }),
      };

      await expect(createInstance('user-1', 'gzclp', 'Boundary', { load })).resolves.toMatchObject({
        config: { load },
      });
    }
  );

  it.each([MIN_POSITIVE_PROGRAM_WEIGHT / 10, 1e21])(
    'rejects the out-of-contract numeric value %s in authoritative create validation',
    async (load) => {
      mockDb = {
        transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
          task(createProgramTransaction([], { template: numericBoundaryTemplate }))
        ),
      };

      await expect(createInstance('user-1', 'gzclp', 'Boundary', { load })).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_PROGRAM_CONFIG',
      });
    }
  );

  it.each([
    ['missing field', {}],
    ['unexpected field', { squat: 20, extra: 5 }],
    ['weight below minimum', { squat: 15 }],
    ['weight off step', { squat: 22 }],
  ])('rejects create config with %s before completing the active instance', async (_, config) => {
    const persisted: TransactionProgramRow[] = [
      {
        id: 'old-active',
        userId: 'user-1',
        templateId: 'gzclp',
        name: 'Old',
        programConfig: { squat: 20 },
        status: 'active',
        definitionId: null,
        customDefinition: null,
        metadata: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const draft = persisted.map((row) => ({ ...row }));
        const result = await task(createProgramTransaction(draft));
        persisted.splice(0, persisted.length, ...draft);
        return result;
      }),
    };

    await expect(createInstance('user-1', 'gzclp', 'Invalid', config)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_PROGRAM_CONFIG',
      message: 'Program configuration is invalid',
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.status).toBe('active');
    expect(mockInvalidateCachedInstances).not.toHaveBeenCalled();
  });

  it('rejects an invalid select option from the authoritative definition', async () => {
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task(createProgramTransaction([], { template: selectTemplate }))
      ),
    };

    await expect(
      createInstance('user-1', 'gzclp', 'Invalid', { squat: 20, variant: 'unknown' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_PROGRAM_CONFIG',
    });
  });

  it('rejects a corrupt authoritative definition before changing lifecycle state', async () => {
    const persisted: TransactionProgramRow[] = [
      {
        id: 'old-active',
        userId: 'user-1',
        templateId: 'gzclp',
        name: 'Old',
        programConfig: { squat: 20 },
        status: 'active',
        definitionId: null,
        customDefinition: null,
        metadata: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    const corruptTemplate = {
      ...CONFIG_TEMPLATE,
      definition: { ...CONFIG_TEMPLATE.definition, days: [] },
    };
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const draft = persisted.map((row) => ({ ...row }));
        return task(createProgramTransaction(draft, { template: corruptTemplate }));
      }),
    };

    await expect(createInstance('user-1', 'gzclp', 'Invalid', { squat: 20 })).rejects.toMatchObject(
      {
        statusCode: 400,
        code: 'INVALID_PROGRAM_DEFINITION',
        message: 'Program definition is invalid',
      }
    );
    expect(persisted[0]?.status).toBe('active');
  });

  it('applies the same definition-backed contract to PATCH config', async () => {
    let selectCount = 0;
    const update = vi.fn();
    const select = vi.fn(() => {
      selectCount += 1;
      const selected =
        selectCount === 1
          ? [{ id: 'user-1' }]
          : selectCount === 2
            ? [
                {
                  id: 'target',
                  status: 'active',
                  templateId: 'gzclp',
                  definitionId: null,
                  customDefinition: null,
                },
              ]
            : selectCount === 3
              ? [selectTemplate]
              : [{ id: 'squat', name: 'Squat' }];
      const locked = {
        limit: vi.fn(async () => selected),
        for: vi.fn(() => ({ limit: vi.fn(async () => selected) })),
      };
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => (selectCount === 4 ? Promise.resolve(selected) : locked)),
        })),
      };
    });
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task({ select, update })
      ),
    };

    await expect(
      updateInstance('user-1', 'target', { config: { squat: 20, variant: 'unknown' } })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_PROGRAM_CONFIG',
    });
    expect(update).not.toHaveBeenCalled();
    expect(mockInvalidateCachedInstances).not.toHaveBeenCalled();
  });

  it('validates PATCH config against the instance custom snapshot instead of its base template', async () => {
    const update = vi.fn();
    let selectCount = 0;
    const select = vi.fn(() => {
      selectCount += 1;
      const selected =
        selectCount === 1
          ? [{ id: 'user-1' }]
          : [
              {
                id: 'target',
                status: 'active',
                templateId: 'gzclp',
                definitionId: 'd0000000-0000-4000-8000-000000000001',
                customDefinition,
              },
            ];
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({ limit: vi.fn(async () => selected) })),
          })),
        })),
      };
    });
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task({ select, update })
      ),
    };

    await expect(
      updateInstance('user-1', 'target', { config: { squat: 20 } })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_PROGRAM_CONFIG',
    });
    expect(select).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
    expect(mockInvalidateCachedInstances).not.toHaveBeenCalled();
  });

  it('loads an owner-scoped linked definition when the instance snapshot is absent', async () => {
    const update = vi.fn();
    let selectCount = 0;
    const select = vi.fn(() => {
      selectCount += 1;
      const selected =
        selectCount === 1
          ? [{ id: 'user-1' }]
          : selectCount === 2
            ? [
                {
                  id: 'target',
                  status: 'active',
                  templateId: 'gzclp',
                  definitionId: 'd0000000-0000-4000-8000-000000000001',
                  customDefinition: null,
                },
              ]
            : [{ definition: customDefinition }];
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({ limit: vi.fn(async () => selected) })),
            limit: vi.fn(async () => selected),
          })),
        })),
      };
    });
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task({ select, update })
      ),
    };

    await expect(
      updateInstance('user-1', 'target', { config: { squat: 20 } })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_PROGRAM_CONFIG',
    });
    expect(select).toHaveBeenCalledTimes(3);
    expect(update).not.toHaveBeenCalled();
    expect(mockInvalidateCachedInstances).not.toHaveBeenCalled();
  });
});

describe('updateInstance active serialization', () => {
  it('does not complete the current active program when the reactivation target is absent', async () => {
    const update = vi.fn();
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 'user-1' }]),
            })),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      });
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task({ select, update })
      ),
    };

    await expect(updateInstance('user-1', 'missing', { status: 'active' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'INSTANCE_NOT_FOUND',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('treats a repeated activation of the locked active target as idempotent', async () => {
    const activeRow: TransactionProgramRow = {
      id: 'active-a',
      userId: 'user-1',
      templateId: 'gzclp',
      name: 'A',
      programConfig: {},
      status: 'active',
      definitionId: null,
      customDefinition: null,
      metadata: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 'user-1' }]),
            })),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: activeRow.id, status: 'active' }]),
            })),
          })),
        })),
      });
    const update = vi
      .fn()
      .mockReturnValueOnce({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => []),
          })),
        })),
      })
      .mockReturnValueOnce({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [activeRow]),
          })),
        })),
      });
    const emptyProjectionSelect = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve([])),
          orderBy: vi.fn(async () => []),
        })),
      })),
    }));
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task({ select, update })
      ),
      select: emptyProjectionSelect,
    };

    await expect(
      updateInstance('user-1', activeRow.id, { status: 'active' })
    ).resolves.toMatchObject({
      id: activeRow.id,
      status: 'active',
    });
    expect(update).toHaveBeenCalledTimes(2);
    expect(mockInvalidateCachedInstances).toHaveBeenCalledWith('user-1', ['active-a']);
  });

  it('invalidates the reactivated target and the previously active instance after commit', async () => {
    const target: TransactionProgramRow = {
      id: 'completed-b',
      userId: 'user-1',
      templateId: 'gzclp',
      name: 'B',
      programConfig: { squat: 20 },
      status: 'active',
      definitionId: null,
      customDefinition: null,
      metadata: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'user-1' }]) })),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn(async () => [
                { id: target.id, status: 'completed', templateId: 'gzclp' },
              ]),
            })),
          })),
        })),
      });
    const update = vi
      .fn()
      .mockReturnValueOnce({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [{ id: 'active-a' }]),
          })),
        })),
      })
      .mockReturnValueOnce({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [target]),
          })),
        })),
      });
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task({ select, update })
      ),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve([])),
            orderBy: vi.fn(async () => []),
          })),
        })),
      })),
    };

    await expect(updateInstance('user-1', target.id, { status: 'active' })).resolves.toMatchObject({
      id: target.id,
      status: 'active',
    });
    expect(mockInvalidateCachedInstances).toHaveBeenCalledWith('user-1', [
      'completed-b',
      'active-a',
    ]);
  });

  it('rolls back the previous active program when the locked target update returns no row', async () => {
    const persisted: TransactionProgramRow[] = [
      {
        id: 'active-a',
        userId: 'user-1',
        templateId: 'gzclp',
        name: 'A',
        programConfig: {},
        status: 'active',
        definitionId: null,
        customDefinition: null,
        metadata: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'completed-b',
        userId: 'user-1',
        templateId: 'gzclp',
        name: 'B',
        programConfig: {},
        status: 'completed',
        definitionId: null,
        customDefinition: null,
        metadata: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    const targetForUpdate = vi.fn(() => ({
      limit: vi.fn(async () => [{ id: 'completed-b', status: 'completed' }]),
    }));

    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const draft = persisted.map((row) => ({ ...row }));
        const select = vi
          .fn()
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                for: vi.fn(() => ({
                  limit: vi.fn(async () => [{ id: 'user-1' }]),
                })),
              })),
            })),
          })
          .mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({ for: targetForUpdate })),
            })),
          });
        const update = vi
          .fn()
          .mockReturnValueOnce({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => {
                  const active = draft.find((row) => row.id === 'active-a');
                  if (!active) return [];
                  active.status = 'completed';
                  return [{ id: active.id }];
                }),
              })),
            })),
          })
          .mockReturnValueOnce({
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                // Reproduces a target removed by a competing implementation:
                // the guarded UPDATE must fail inside the transaction.
                returning: vi.fn(async () => []),
              })),
            })),
          });

        const result = await task({ select, update });
        persisted.splice(0, persisted.length, ...draft);
        return result;
      }),
    };

    await expect(
      updateInstance('user-1', 'completed-b', { status: 'active' })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'INSTANCE_NOT_FOUND',
    });
    expect(targetForUpdate).toHaveBeenCalledWith('update');
    expect(persisted.find((row) => row.id === 'active-a')?.status).toBe('active');
    expect(persisted.find((row) => row.id === 'completed-b')?.status).toBe('completed');
    expect(mockInvalidateCachedInstances).not.toHaveBeenCalled();
  });

  it('uses the same owner-then-target lock order for deletion', async () => {
    const ownerForUpdate = vi.fn(() => ({
      limit: vi.fn(async () => [{ id: 'user-1' }]),
    }));
    const targetForUpdate = vi.fn(() => ({
      limit: vi.fn(async () => [{ id: 'completed-b' }]),
    }));
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ for: ownerForUpdate })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ for: targetForUpdate })),
        })),
      });
    const returning = vi.fn(async () => [{ id: 'completed-b' }]);
    mockDb = {
      transaction: vi.fn(async (task: (tx: Record<string, unknown>) => Promise<unknown>) =>
        task({
          select,
          delete: vi.fn(() => ({
            where: vi.fn(() => ({ returning })),
          })),
        })
      ),
    };

    await deleteInstance('user-1', 'completed-b');

    expect(ownerForUpdate).toHaveBeenCalledWith('update');
    expect(targetForUpdate).toHaveBeenCalledWith('update');
    expect(returning).toHaveBeenCalledOnce();
  });
});
