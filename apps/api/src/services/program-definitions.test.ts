/**
 * Program definitions service tests — unit tests for all service functions.
 * Tests are self-contained; no DB connection required.
 *
 * Uses mock.module() to intercept getDb() calls with a chainable mock
 * that mimics the Drizzle query builder. Each test configures the mock
 * chain to return specific data, validating business logic in isolation.
 */
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect, beforeEach } from 'bun:test';
import type { ApiError as ApiErrorType } from '../middleware/error-handler';

// ---------------------------------------------------------------------------
// DB Mock — chainable query builder
//
// Each select/insert/update call on the mock returns a deeply chainable
// object. The terminal methods (limit, offset, returning) resolve to the
// result configured for that call index.
// ---------------------------------------------------------------------------

let mockQueryResult: unknown[] = [];

// Each call to mockDb.select() or mockDb.select({...}) pops the next result
let selectCallIndex = 0;
const selectResults: unknown[][] = [];

/** Creates a chain object that resolves to `result` at any terminal point. */
function makeChain(result: unknown[]): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  const resolver = (): Promise<unknown[]> => Promise.resolve(result);
  // Every method returns self (chainable) except terminal ones
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset', 'returning', 'values', 'set'];
  for (const m of methods) {
    if (m === 'limit' || m === 'offset' || m === 'returning') {
      // Terminal: return a thenable that also has further chainable methods
      self[m] = mock((): unknown => {
        const p = resolver();
        // Also make the result chainable (e.g., .limit().offset() )
        return Object.assign(p, {
          offset: mock(resolver),
          limit: mock(resolver),
        });
      });
    } else {
      self[m] = mock((): Record<string, unknown> => self);
    }
  }
  // Also make it a thenable (for Promise.all direct resolution)
  self['then'] = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ): unknown => resolver().then(onFulfilled, onRejected);
  return self;
}

const mockDb = {
  select: mock(function () {
    const idx = selectCallIndex++;
    const result = selectResults[idx] ?? mockQueryResult;
    return makeChain(result);
  }),
  insert: mock(function () {
    return makeChain(mockQueryResult);
  }),
  update: mock(function () {
    return makeChain(mockQueryResult);
  }),
};

mock.module('../db', () => ({
  getDb: mock(() => mockDb),
}));

// Mock catalog-cache — needed because program-definitions.ts imports invalidation functions
const mockInvalidateCatalogList = mock(async (): Promise<void> => undefined);
const mockInvalidateCatalogDetail = mock(async (): Promise<void> => undefined);

mock.module('../lib/catalog-cache', () => ({
  invalidateCatalogList: mockInvalidateCatalogList,
  invalidateCatalogDetail: mockInvalidateCatalogDetail,
}));

// Mock isRecord from shared — needed by program-definitions.ts for catalog invalidation
mock.module('@gzclp/shared/type-guards', () => ({
  isRecord: (v: unknown): boolean => typeof v === 'object' && v !== null && !Array.isArray(v),
}));

// Must import AFTER mock.module — use dynamic import to ensure mocks are applied first
const {
  parseAdminUserIds,
  isAdmin,
  reloadAdminUserIds,
  toResponse,
  create,
  list,
  getById,
  update,
  softDelete,
  updateStatus,
} = await import('./program-definitions');
const { ApiError } = await import('../middleware/error-handler');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface ProgramDefinitionRowFixture {
  readonly id: string;
  readonly userId: string;
  readonly definition: unknown;
  readonly status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function makeDefinitionRow(
  overrides: Partial<ProgramDefinitionRowFixture> = {}
): ProgramDefinitionRowFixture {
  return {
    id: 'def-uuid-001',
    userId: 'user-uuid-001',
    definition: {},
    status: 'draft',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeValidDefinition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'my-custom-program',
    name: 'My Custom Program',
    description: 'A custom test program',
    author: 'Test User',
    version: 1,
    category: 'strength',
    source: 'custom',
    cycleLength: 2,
    totalWorkouts: 10,
    workoutsPerWeek: 3,
    exercises: {
      squat: { name: 'Squat' },
    },
    configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 2.5, step: 2.5 }],
    weightIncrements: { squat: 5 },
    days: [
      {
        name: 'Day 1',
        slots: [
          {
            id: 'd1-t1',
            exerciseId: 'squat',
            tier: 't1',
            stages: [{ sets: 5, reps: 3 }],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'no_change' },
            onFinalStageFail: { type: 'deload_percent', percent: 10 },
            startWeightKey: 'squat',
          },
        ],
      },
      {
        name: 'Day 2',
        slots: [
          {
            id: 'd2-t1',
            exerciseId: 'squat',
            tier: 't1',
            stages: [{ sets: 5, reps: 3 }],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'no_change' },
            onFinalStageFail: { type: 'deload_percent', percent: 10 },
            startWeightKey: 'squat',
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockQueryResult = [];
  selectCallIndex = 0;
  selectResults.length = 0;
  mockDb.select.mockClear();
  mockDb.insert.mockClear();
  mockDb.update.mockClear();
  mockInvalidateCatalogList.mockClear();
  mockInvalidateCatalogDetail.mockClear();
});

// ---------------------------------------------------------------------------
// toResponse
// ---------------------------------------------------------------------------

describe('toResponse', () => {
  it('maps DB row to ProgramDefinitionResponse with ISO string dates', () => {
    const row = makeDefinitionRow();

    const response = toResponse(row as never);

    expect(response.id).toBe('def-uuid-001');
    expect(response.userId).toBe('user-uuid-001');
    expect(response.status).toBe('draft');
    expect(response.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(response.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(response.deletedAt).toBeNull();
  });

  it('sets deletedAt to ISO string when row has a deletedAt date', () => {
    const row = makeDefinitionRow({ deletedAt: new Date('2026-02-01T12:00:00Z') });

    const response = toResponse(row as never);

    expect(response.deletedAt).toBe('2026-02-01T12:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// parseAdminUserIds / isAdmin
// ---------------------------------------------------------------------------

describe('parseAdminUserIds', () => {
  it('returns empty set when env not set', () => {
    delete process.env['ADMIN_USER_IDS'];
    const result = parseAdminUserIds();

    expect(result.size).toBe(0);
  });

  it('parses comma-separated UUIDs', () => {
    process.env['ADMIN_USER_IDS'] = 'uuid-a,uuid-b';
    const result = parseAdminUserIds();

    expect(result.has('uuid-a')).toBe(true);
    expect(result.has('uuid-b')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('trims whitespace from UUIDs', () => {
    process.env['ADMIN_USER_IDS'] = ' uuid-a , uuid-b ';
    const result = parseAdminUserIds();

    expect(result.has('uuid-a')).toBe(true);
    expect(result.has('uuid-b')).toBe(true);
  });

  it('returns empty set for empty string', () => {
    process.env['ADMIN_USER_IDS'] = '';
    const result = parseAdminUserIds();

    expect(result.size).toBe(0);
  });
});

describe('isAdmin', () => {
  it('returns true for listed user', () => {
    process.env['ADMIN_USER_IDS'] = 'uuid-a,uuid-b';
    reloadAdminUserIds();

    expect(isAdmin('uuid-a')).toBe(true);
    expect(isAdmin('uuid-b')).toBe(true);
  });

  it('returns false for unlisted user', () => {
    process.env['ADMIN_USER_IDS'] = 'uuid-a';
    reloadAdminUserIds();

    expect(isAdmin('uuid-c')).toBe(false);
  });

  it('returns false when env not set', () => {
    delete process.env['ADMIN_USER_IDS'];
    reloadAdminUserIds();

    expect(isAdmin('any-id')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('create', () => {
  it('returns definition with status draft for valid custom definition', async () => {
    const createdRow = makeDefinitionRow();
    mockQueryResult = [createdRow];
    // First select call: count query returns 0
    selectResults[0] = [{ value: 0 }];

    const result = await create('user-uuid-001', makeValidDefinition());

    expect(result.status).toBe('draft');
    expect(result.userId).toBe('user-uuid-001');
    expect(result.id).toBe('def-uuid-001');
  });

  it('throws ApiError 422 for invalid definition payload', async () => {
    try {
      await create('user-uuid-001', { notADefinition: true });
      expect(true).toBe(false); // should not reach here
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(422);
      expect((e as ApiErrorType).code).toBe('VALIDATION_ERROR');
    }
  });

  it('throws ApiError 422 when source is not custom', async () => {
    try {
      await create('user-uuid-001', makeValidDefinition({ source: 'preset' }));
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(422);
      expect((e as ApiErrorType).code).toBe('VALIDATION_ERROR');
    }
  });

  it('throws ApiError 409 when user has 10 active definitions', async () => {
    // Make count return 10
    selectResults[0] = [{ value: 10 }];

    try {
      await create('user-uuid-001', makeValidDefinition());
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(409);
      expect((e as ApiErrorType).code).toBe('LIMIT_EXCEEDED');
    }
  });

  it('allows creation when user has exactly 9 definitions', async () => {
    const createdRow = makeDefinitionRow();
    mockQueryResult = [createdRow];
    selectResults[0] = [{ value: 9 }];

    const result = await create('user-uuid-001', makeValidDefinition());

    expect(result.id).toBe('def-uuid-001');
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe('list', () => {
  it('returns only definitions for the requesting user', async () => {
    const rows = [
      makeDefinitionRow({ id: 'def-1' }),
      makeDefinitionRow({ id: 'def-2' }),
      makeDefinitionRow({ id: 'def-3' }),
    ];
    // First select: data rows
    selectResults[0] = rows;
    // Second select: count
    selectResults[1] = [{ value: 3 }];

    const result = await list('user-uuid-001', 0, 20);

    expect(result.data.length).toBe(3);
    expect(result.total).toBe(3);
    for (const item of result.data) {
      expect(item.userId).toBe('user-uuid-001');
    }
  });

  it('excludes soft-deleted definitions', async () => {
    // DB returns only non-deleted rows (query filter handles this)
    selectResults[0] = [makeDefinitionRow({ id: 'def-1' }), makeDefinitionRow({ id: 'def-2' })];
    selectResults[1] = [{ value: 2 }];

    const result = await list('user-uuid-001', 0, 20);

    expect(result.data.length).toBe(2);
    expect(result.total).toBe(2);
  });

  it('applies offset and limit', async () => {
    selectResults[0] = [makeDefinitionRow({ id: 'def-3' }), makeDefinitionRow({ id: 'def-4' })];
    selectResults[1] = [{ value: 5 }];

    const result = await list('user-uuid-001', 2, 2);

    expect(result.data.length).toBe(2);
  });

  it('returns empty list for user with no definitions', async () => {
    selectResults[0] = [];
    selectResults[1] = [{ value: 0 }];

    const result = await list('user-uuid-001', 0, 20);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

describe('getById', () => {
  it('returns definition for correct owner', async () => {
    selectResults[0] = [makeDefinitionRow({ id: 'def-uuid-001', userId: 'user-uuid-001' })];

    const result = await getById('user-uuid-001', 'def-uuid-001');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('def-uuid-001');
  });

  it('returns null for wrong owner', async () => {
    selectResults[0] = [];

    const result = await getById('user-uuid-002', 'def-uuid-001');

    expect(result).toBeNull();
  });

  it('returns null for soft-deleted definition', async () => {
    selectResults[0] = [];

    const result = await getById('user-uuid-001', 'def-uuid-002');

    expect(result).toBeNull();
  });

  it('returns null for non-existent id', async () => {
    selectResults[0] = [];

    const result = await getById('user-uuid-001', 'non-existent');

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('update', () => {
  it('returns updated definition and keeps draft status', async () => {
    // First select: current row for status check
    selectResults[0] = [makeDefinitionRow({ status: 'draft' })];
    // Update returning
    mockQueryResult = [makeDefinitionRow({ status: 'draft' })];

    const result = await update('user-uuid-001', 'def-uuid-001', makeValidDefinition());

    expect(result.status).toBe('draft');
  });

  it('resets status from pending_review to draft on update', async () => {
    selectResults[0] = [makeDefinitionRow({ status: 'pending_review' })];
    mockQueryResult = [makeDefinitionRow({ status: 'draft' })];

    const result = await update('user-uuid-001', 'def-uuid-001', makeValidDefinition());

    expect(result.status).toBe('draft');
  });

  it('resets status from approved to draft on update', async () => {
    selectResults[0] = [makeDefinitionRow({ status: 'approved' })];
    mockQueryResult = [makeDefinitionRow({ status: 'draft' })];

    const result = await update('user-uuid-001', 'def-uuid-001', makeValidDefinition());

    expect(result.status).toBe('draft');
  });

  it('keeps rejected status on update', async () => {
    selectResults[0] = [makeDefinitionRow({ status: 'rejected' })];
    mockQueryResult = [makeDefinitionRow({ status: 'rejected' })];

    const result = await update('user-uuid-001', 'def-uuid-001', makeValidDefinition());

    expect(result.status).toBe('rejected');
  });

  it('throws ApiError 404 when updating another user definition', async () => {
    selectResults[0] = [];

    try {
      await update('user-uuid-002', 'def-uuid-001', makeValidDefinition());
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(404);
      expect((e as ApiErrorType).code).toBe('NOT_FOUND');
    }
  });

  it('throws ApiError 422 for invalid definition', async () => {
    try {
      await update('user-uuid-001', 'def-uuid-001', { invalid: true });
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(422);
      expect((e as ApiErrorType).code).toBe('VALIDATION_ERROR');
    }
  });
});

// ---------------------------------------------------------------------------
// softDelete
// ---------------------------------------------------------------------------

describe('softDelete', () => {
  it('returns true when soft-deleting owned definition', async () => {
    mockQueryResult = [{ id: 'def-uuid-001' }];

    const result = await softDelete('user-uuid-001', 'def-uuid-001');

    expect(result).toBe(true);
  });

  it('returns false for wrong owner', async () => {
    mockQueryResult = [];

    const result = await softDelete('user-uuid-002', 'def-uuid-001');

    expect(result).toBe(false);
  });

  it('returns false for already-deleted definition', async () => {
    mockQueryResult = [];

    const result = await softDelete('user-uuid-001', 'def-uuid-002');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateStatus — owner transitions
// ---------------------------------------------------------------------------

describe('updateStatus — owner transitions', () => {
  it('owner can submit draft definition for review', async () => {
    process.env['ADMIN_USER_IDS'] = '';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'draft' })];
    mockQueryResult = [makeDefinitionRow({ status: 'pending_review' })];

    const result = await updateStatus('user-uuid-001', 'def-uuid-001', 'pending_review');

    expect(result.status).toBe('pending_review');
  });

  it('owner can withdraw definition from review', async () => {
    process.env['ADMIN_USER_IDS'] = '';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'pending_review' })];
    mockQueryResult = [makeDefinitionRow({ status: 'draft' })];

    const result = await updateStatus('user-uuid-001', 'def-uuid-001', 'draft');

    expect(result.status).toBe('draft');
  });

  it('owner cannot approve own definition', async () => {
    process.env['ADMIN_USER_IDS'] = '';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'pending_review' })];

    try {
      await updateStatus('user-uuid-001', 'def-uuid-001', 'approved');
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(403);
      expect((e as ApiErrorType).code).toBe('FORBIDDEN');
    }
  });
});

// ---------------------------------------------------------------------------
// updateStatus — admin transitions
// ---------------------------------------------------------------------------

describe('updateStatus — admin transitions', () => {
  it('admin can approve pending_review definition', async () => {
    process.env['ADMIN_USER_IDS'] = 'admin-uuid-001';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'pending_review' })];
    mockQueryResult = [makeDefinitionRow({ status: 'approved' })];

    const result = await updateStatus('admin-uuid-001', 'def-uuid-001', 'approved');

    expect(result.status).toBe('approved');
  });

  it('admin can reject pending_review definition', async () => {
    process.env['ADMIN_USER_IDS'] = 'admin-uuid-001';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'pending_review' })];
    mockQueryResult = [makeDefinitionRow({ status: 'rejected' })];

    const result = await updateStatus('admin-uuid-001', 'def-uuid-001', 'rejected');

    expect(result.status).toBe('rejected');
  });

  it('non-admin cannot approve another user definition', async () => {
    process.env['ADMIN_USER_IDS'] = '';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'pending_review' })];

    try {
      await updateStatus('user-uuid-002', 'def-uuid-001', 'approved');
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(403);
      expect((e as ApiErrorType).code).toBe('FORBIDDEN');
    }
  });
});

// ---------------------------------------------------------------------------
// updateStatus — invalid transitions and edge cases
// ---------------------------------------------------------------------------

describe('updateStatus — invalid transitions and edge cases', () => {
  it('throws FORBIDDEN for approved -> pending_review transition by owner', async () => {
    process.env['ADMIN_USER_IDS'] = '';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'approved' })];

    try {
      await updateStatus('user-uuid-001', 'def-uuid-001', 'pending_review');
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(403);
      expect((e as ApiErrorType).code).toBe('FORBIDDEN');
    }
  });

  it('throws FORBIDDEN when no admins are configured and admin transition attempted', async () => {
    process.env['ADMIN_USER_IDS'] = '';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'pending_review' })];

    try {
      await updateStatus('user-uuid-002', 'def-uuid-001', 'approved');
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(403);
    }
  });

  it('throws NOT_FOUND for non-existent definition id', async () => {
    selectResults[0] = [];

    try {
      await updateStatus('user-uuid-001', 'non-existent', 'pending_review');
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(404);
      expect((e as ApiErrorType).code).toBe('NOT_FOUND');
    }
  });

  it('throws FORBIDDEN for draft -> approved (must go through review)', async () => {
    process.env['ADMIN_USER_IDS'] = 'admin-uuid-001';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'draft' })];

    try {
      await updateStatus('admin-uuid-001', 'def-uuid-001', 'approved');
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(403);
    }
  });

  it('throws FORBIDDEN for rejected -> approved (must edit first)', async () => {
    process.env['ADMIN_USER_IDS'] = 'admin-uuid-001';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'rejected' })];

    try {
      await updateStatus('admin-uuid-001', 'def-uuid-001', 'approved');
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiErrorType).statusCode).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// updateStatus — catalog cache invalidation (REQ-CATCACHE-003)
// ---------------------------------------------------------------------------

describe('updateStatus — catalog cache invalidation', () => {
  it('calls invalidateCatalogList and invalidateCatalogDetail on approval', async () => {
    // Arrange
    process.env['ADMIN_USER_IDS'] = 'admin-uuid-001';
    reloadAdminUserIds();

    const definition = makeValidDefinition();
    selectResults[0] = [
      makeDefinitionRow({
        userId: 'user-uuid-001',
        status: 'pending_review',
        definition,
      }),
    ];
    mockQueryResult = [makeDefinitionRow({ status: 'approved', definition })];

    // Act
    await updateStatus('admin-uuid-001', 'def-uuid-001', 'approved');

    // Assert
    expect(mockInvalidateCatalogList).toHaveBeenCalledTimes(1);
    expect(mockInvalidateCatalogDetail).toHaveBeenCalledTimes(1);
  });

  it('does NOT call catalog invalidation on rejection', async () => {
    // Arrange
    process.env['ADMIN_USER_IDS'] = 'admin-uuid-001';
    reloadAdminUserIds();

    selectResults[0] = [makeDefinitionRow({ userId: 'user-uuid-001', status: 'pending_review' })];
    mockQueryResult = [makeDefinitionRow({ status: 'rejected' })];

    // Act
    await updateStatus('admin-uuid-001', 'def-uuid-001', 'rejected');

    // Assert
    expect(mockInvalidateCatalogList).not.toHaveBeenCalled();
    expect(mockInvalidateCatalogDetail).not.toHaveBeenCalled();
  });
});
