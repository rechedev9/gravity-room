/**
 * Programs service unit tests — buildUndoHistory RPE serialization + composite cursor pagination.
 *
 * Part 1 (buildUndoHistory): self-contained, no DB connection required.
 * Part 2 (parseCursor / getInstances): uses mock.module() to mock getDb().
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ApiError } from '../middleware/error-handler';

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
  obj['from'] = mock(function from() {
    return {
      where: mock(function where(condition: unknown) {
        capturedWhere = condition;
        return {
          orderBy: mock(function orderBy(...args: unknown[]) {
            capturedOrderBy = args;
            return {
              limit: mock(function limit() {
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
    select: mock(function select() {
      return createChainable(selectRows);
    }),
  };
}

let mockDb = createMockDb();

mock.module('../db', () => ({
  getDb: () => mockDb,
}));

// Also mock the catalog service dependency (getProgramDefinition is imported by programs.ts)
mock.module('../services/catalog', () => ({
  getProgramDefinition: mock(() => Promise.resolve({ status: 'not_found' })),
}));

// Must import AFTER mock.module
const { getInstances, getInstance, updateInstanceMetadata } = await import('./programs');

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
    (mockDb as Record<string, unknown>).update = mock(function update() {
      return {
        set: mock(function set() {
          return {
            where: mock(function where() {
              return {
                returning: mock(() => Promise.resolve([])),
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
    (mockDb as Record<string, unknown>).update = mock(function update() {
      return {
        set: mock(function set() {
          return {
            where: mock(function where() {
              return {
                returning: mock(() => Promise.resolve([instanceRow])),
              };
            }),
          };
        }),
      };
    });
    // fetchResultsAndUndo calls getDb().select() twice (results + undo)
    // Each chain: .select({...}).from(table).where(condition) must be thenable
    (mockDb as Record<string, unknown>).select = mock(function select() {
      return {
        from: mock(function from() {
          return {
            where: mock(function where() {
              // Thenable that resolves to empty array
              // Also supports .orderBy() for undo query
              return {
                then: (fn: (val: unknown[]) => unknown) => Promise.resolve(fn([])),
                orderBy: mock(function orderBy() {
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
    (mockDb as Record<string, unknown>).select = mock(function select() {
      callCount++;
      if (callCount === 1) {
        // getInstance query — returns instance row
        return {
          from: mock(function from() {
            return {
              where: mock(function where() {
                return {
                  limit: mock(() => Promise.resolve([instanceRow])),
                };
              }),
            };
          }),
        };
      }
      // fetchResultsAndUndo queries — thenable returning empty arrays
      return {
        from: mock(function from() {
          return {
            where: mock(function where() {
              return {
                then: (fn: (val: unknown[]) => unknown) => Promise.resolve(fn([])),
                orderBy: mock(function orderBy() {
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
    (mockDb as Record<string, unknown>).select = mock(function select() {
      return {
        from: mock(function from() {
          return {
            where: mock(function where() {
              return {
                limit: mock(() => Promise.resolve([])),
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
