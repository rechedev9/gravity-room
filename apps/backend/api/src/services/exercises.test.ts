/**
 * Exercises service unit tests — verifies listExercises, listMuscleGroups,
 * and createExercise behavior with mocked DB.
 *
 * Strategy: mock getDb() at module level so the service functions use our fake.
 * Each query chain is tracked by call order, allowing tests to control responses.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB — track calls via a queue
// ---------------------------------------------------------------------------

interface ExerciseRow {
  readonly id: string;
  readonly name: string;
  readonly muscleGroupId: string;
  readonly equipment: string | null;
  readonly isCompound: boolean;
  readonly isSystem: boolean;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
  readonly forceType: string | null;
  readonly level: string | null;
  readonly movementMechanic: string | null;
  readonly category: string | null;
  readonly secondaryMuscles: readonly string[] | null;
}

const NOW = new Date();

const PRESET_EXERCISE: ExerciseRow = {
  id: 'squat',
  name: 'Sentadilla',
  muscleGroupId: 'legs',
  equipment: 'barbell',
  isCompound: true,
  isSystem: true,
  createdByUserId: null,
  createdAt: NOW,
  forceType: 'push',
  level: 'beginner',
  movementMechanic: 'compound',
  category: 'strength',
  secondaryMuscles: ['back', 'core'],
};

const USER_EXERCISE: ExerciseRow = {
  id: 'my_curl',
  name: 'My Custom Curl',
  muscleGroupId: 'arms',
  equipment: 'dumbbell',
  isCompound: false,
  isSystem: false,
  createdByUserId: 'user-1',
  createdAt: NOW,
  forceType: 'pull',
  level: 'beginner',
  movementMechanic: 'isolation',
  category: 'strength',
  secondaryMuscles: null,
};

/**
 * Queue-based mock: each call to select().from() pops the next result
 * from selectQueue. insert().values(vals).onConflictDoNothing().returning()
 * returns insertHandler(vals) when an insertHandler is set (so tests can vary
 * the outcome by the inserted id, e.g. to simulate a slug collision), otherwise
 * the static insertResult.
 */
let selectQueue: unknown[][] = [];
let insertResult: unknown[] = [];
let insertHandler: ((values: Record<string, unknown>) => unknown[]) | undefined = undefined;

function chainable(result: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  obj['where'] = vi.fn(() => chainable(result));
  obj['orderBy'] = vi.fn(() => chainable(result));
  obj['limit'] = vi.fn(() => chainable(result));
  obj['offset'] = vi.fn(() => chainable(result));
  // Make thenable so `await db.select().from(table).where(...)` works
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

function createMockDb(): unknown {
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
        values: vi.fn(function values(vals: Record<string, unknown>) {
          const compute = (): unknown[] => (insertHandler ? insertHandler(vals) : insertResult);
          return {
            onConflictDoNothing: vi.fn(function onConflictDoNothing() {
              return {
                returning: vi.fn(() => Promise.resolve(compute())),
              };
            }),
            returning: vi.fn(() => Promise.resolve(compute())),
          };
        }),
      };
    }),
  };
}

let mockDb = createMockDb();

vi.mock('../db', () => ({
  getDb: () => mockDb,
}));

// ---------------------------------------------------------------------------
// Mock exercise cache and muscle-groups cache
// ---------------------------------------------------------------------------

interface PaginatedExercisesFixture {
  readonly data: readonly ExerciseRow[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

let cachedExercisesResult: PaginatedExercisesFixture | undefined = undefined;
let cachedMuscleGroupsResult: readonly { id: string; name: string }[] | undefined = undefined;

const mockGetCachedExercises = vi.fn(
  async (): Promise<PaginatedExercisesFixture | undefined> => cachedExercisesResult
);
const mockSetCachedExercises = vi.fn(async (): Promise<void> => undefined);
const mockGetCachedMuscleGroups = vi.fn(
  async (): Promise<readonly { id: string; name: string }[] | undefined> => cachedMuscleGroupsResult
);
const mockSetCachedMuscleGroups = vi.fn(async (): Promise<void> => undefined);
const mockInvalidateUserExercises = vi.fn(async (): Promise<void> => undefined);
const mockBuildFilterHash = vi.fn((): string => '');

vi.mock('../lib/exercise-cache', () => ({
  getCachedExercises: mockGetCachedExercises,
  setCachedExercises: mockSetCachedExercises,
  invalidateUserExercises: mockInvalidateUserExercises,
  buildFilterHash: mockBuildFilterHash,
}));

vi.mock('../lib/muscle-groups-cache', () => ({
  getCachedMuscleGroups: mockGetCachedMuscleGroups,
  setCachedMuscleGroups: mockSetCachedMuscleGroups,
}));

// Must import AFTER mock.module
const { listExercises, listMuscleGroups, createExercise } = await import('./exercises');
const { ApiError } = await import('../middleware/error-handler');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  selectQueue = [];
  insertResult = [];
  insertHandler = undefined;
  mockDb = createMockDb();
  cachedExercisesResult = undefined;
  cachedMuscleGroupsResult = undefined;
  mockGetCachedExercises.mockClear();
  mockSetCachedExercises.mockClear();
  mockGetCachedMuscleGroups.mockClear();
  mockSetCachedMuscleGroups.mockClear();
  mockBuildFilterHash.mockClear();
  mockInvalidateUserExercises.mockClear();
});

describe('listExercises', () => {
  it('should return exercises from DB', async () => {
    // listExercises does: db.select().from(exercises).where(condition) + count query
    selectQueue = [[PRESET_EXERCISE], [{ value: 1 }]];

    const result = await listExercises(undefined);

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.id).toBe('squat');
    expect(result.data[0]?.isPreset).toBe(true);
  });

  it('should map DB rows to ExerciseEntry interface', async () => {
    selectQueue = [[PRESET_EXERCISE], [{ value: 1 }]];

    const result = await listExercises(undefined);

    const entry = result.data[0];
    expect(entry?.name).toBe('Sentadilla');
    expect(entry?.muscleGroupId).toBe('legs');
    expect(entry?.equipment).toBe('barbell');
    expect(entry?.isCompound).toBe(true);
  });

  it('should return both preset and user exercises when userId is provided', async () => {
    selectQueue = [[PRESET_EXERCISE, USER_EXERCISE], [{ value: 2 }]];

    const result = await listExercises('user-1');

    expect(result.data).toHaveLength(2);
  });

  it('should accept a text search filter', async () => {
    selectQueue = [[PRESET_EXERCISE], [{ value: 1 }]];

    const result = await listExercises(undefined, { q: 'Sent' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.name).toBe('Sentadilla');
  });

  it('rejects oversized text search before cache or database work', async () => {
    try {
      await listExercises(undefined, { q: 's'.repeat(101) });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as InstanceType<typeof ApiError>).statusCode).toBe(400);
      expect((err as InstanceType<typeof ApiError>).code).toBe('INVALID_FILTER');
      expect(mockBuildFilterHash).not.toHaveBeenCalled();
      expect(mockGetCachedExercises).not.toHaveBeenCalled();
      expect(selectQueue).toHaveLength(0);
    }
  });

  it('should accept an empty filter and return all exercises', async () => {
    selectQueue = [[PRESET_EXERCISE, USER_EXERCISE], [{ value: 2 }]];

    const result = await listExercises('user-1', {});

    expect(result.data).toHaveLength(2);
  });

  it('should accept a muscleGroupId array filter', async () => {
    selectQueue = [[PRESET_EXERCISE], [{ value: 1 }]];

    const result = await listExercises(undefined, { muscleGroupId: ['legs'] });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.muscleGroupId).toBe('legs');
  });

  it('rejects too many array filter values before cache or database work', async () => {
    try {
      await listExercises(undefined, {
        muscleGroupId: Array.from({ length: 21 }, (_, i) => `mg-${i}`),
      });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as InstanceType<typeof ApiError>).statusCode).toBe(400);
      expect((err as InstanceType<typeof ApiError>).code).toBe('INVALID_FILTER');
      expect(mockBuildFilterHash).not.toHaveBeenCalled();
      expect(mockGetCachedExercises).not.toHaveBeenCalled();
      expect(selectQueue).toHaveLength(0);
    }
  });

  it('rejects oversized array filter values before cache or database work', async () => {
    try {
      await listExercises(undefined, { equipment: ['e'.repeat(81)] });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as InstanceType<typeof ApiError>).statusCode).toBe(400);
      expect((err as InstanceType<typeof ApiError>).code).toBe('INVALID_FILTER');
      expect(mockBuildFilterHash).not.toHaveBeenCalled();
      expect(mockGetCachedExercises).not.toHaveBeenCalled();
      expect(selectQueue).toHaveLength(0);
    }
  });

  it('should accept an isCompound boolean filter', async () => {
    selectQueue = [[PRESET_EXERCISE], [{ value: 1 }]];

    const result = await listExercises(undefined, { isCompound: true });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.isCompound).toBe(true);
  });

  it('should propagate new fields (force, secondaryMuscles)', async () => {
    selectQueue = [[PRESET_EXERCISE], [{ value: 1 }]];

    const result = await listExercises(undefined);

    expect(result.data[0]?.force).toBe('push');
    expect(result.data[0]?.secondaryMuscles).toEqual(['back', 'core']);
  });

  it('returns cached result without calling DB when cache hits', async () => {
    // Arrange — cache returns paginated data
    cachedExercisesResult = { data: [PRESET_EXERCISE], total: 1, offset: 0, limit: 100 };

    // Act
    const result = await listExercises(undefined);

    // Assert — DB select should not have been called
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('squat');
    expect(mockGetCachedExercises).toHaveBeenCalledTimes(1);
  });

  it('calls DB and then setCachedExercises on cache miss', async () => {
    // Arrange — cache misses, DB returns data + count
    cachedExercisesResult = undefined;
    selectQueue = [[PRESET_EXERCISE], [{ value: 1 }]];

    // Act
    await listExercises(undefined);

    // Assert — called twice: fast-path check + re-check inside singleflight
    expect(mockGetCachedExercises).toHaveBeenCalledTimes(2);
    expect(mockSetCachedExercises).toHaveBeenCalledTimes(1);
  });
});

describe('listMuscleGroups', () => {
  it('should return muscle groups from DB', async () => {
    // listMuscleGroups does: db.select({id, name}).from(muscleGroups)
    selectQueue = [[{ id: 'legs', name: 'Piernas' }]];

    const result = await listMuscleGroups();

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.id).toBe('legs');
    expect(result[0]?.name).toBe('Piernas');
  });
});

/**
 * Build a full DB row from the values passed to insert(), so an insertHandler
 * can echo back a realistic row for whatever id the service actually inserts
 * (base slug or disambiguated). Narrows without casts to satisfy type safety.
 */
function buildInsertedRow(vals: Record<string, unknown>): ExerciseRow {
  const id = typeof vals['id'] === 'string' ? vals['id'] : '';
  const name = typeof vals['name'] === 'string' ? vals['name'] : '';
  const muscleGroupId = typeof vals['muscleGroupId'] === 'string' ? vals['muscleGroupId'] : '';
  const equipment = typeof vals['equipment'] === 'string' ? vals['equipment'] : null;
  const createdByUserId =
    typeof vals['createdByUserId'] === 'string' ? vals['createdByUserId'] : null;
  return {
    id,
    name,
    muscleGroupId,
    equipment,
    isCompound: vals['isCompound'] === true,
    isSystem: false,
    createdByUserId,
    createdAt: NOW,
    forceType: null,
    level: null,
    movementMechanic: null,
    category: null,
    secondaryMuscles: null,
  };
}

describe('createExercise', () => {
  it('should return Ok with created exercise on success', async () => {
    const createdRow: ExerciseRow = {
      id: 'custom_press',
      name: 'Custom Press',
      muscleGroupId: 'chest',
      equipment: null,
      isCompound: false,
      isSystem: false,
      createdByUserId: 'user-1',
      createdAt: NOW,
      forceType: null,
      level: null,
      movementMechanic: null,
      category: null,
      secondaryMuscles: null,
    };
    // createExercise does: 1) select muscle group, 2) insert exercise
    selectQueue = [[{ id: 'chest' }]]; // muscle group validation
    insertResult = [createdRow];

    const result = await createExercise('user-1', {
      id: 'custom_press',
      name: 'Custom Press',
      muscleGroupId: 'chest',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe('custom_press');
    expect(result.value.isPreset).toBe(false);
    expect(result.value.createdBy).toBe('user-1');
  });

  it('should return Err(INVALID_MUSCLE_GROUP) when muscle group does not exist', async () => {
    selectQueue = [[]]; // muscle group not found

    const result = await createExercise('user-1', {
      id: 'bad_exercise',
      name: 'Bad Exercise',
      muscleGroupId: 'nonexistent',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_MUSCLE_GROUP');
  });

  it('rejects oversized names before reading muscle groups', async () => {
    selectQueue = [[{ id: 'chest' }]];
    insertResult = [
      {
        ...USER_EXERCISE,
        id: 'oversized',
        name: 'x'.repeat(101),
        muscleGroupId: 'chest',
      },
    ];

    const result = await createExercise('user-1', {
      id: 'oversized',
      name: 'x'.repeat(101),
      muscleGroupId: 'chest',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_EXERCISE_INPUT');
    expect(selectQueue).toHaveLength(1);
    expect(mockInvalidateUserExercises).not.toHaveBeenCalled();
  });

  it('returns EXERCISE_ID_CONFLICT only when the SAME user already owns that base id', async () => {
    // Muscle group exists; base-slug insert conflicts; the existing owner is
    // this same user with a custom (non-system) row → a genuine duplicate.
    selectQueue = [
      [{ id: 'legs' }], // muscle group validation
      [{ createdByUserId: 'user-1', isSystem: false }], // existing owner of base id
    ];
    insertHandler = () => []; // base-id insert conflicts

    const result = await createExercise('user-1', {
      id: 'my_curl',
      name: 'My Custom Curl',
      muscleGroupId: 'legs',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('EXERCISE_ID_CONFLICT');
    // Did not fall through to the disambiguation retries.
    expect(mockInvalidateUserExercises).not.toHaveBeenCalled();
  });

  it('disambiguates instead of 409 when the base slug is a system preset', async () => {
    // A preset owns the slug; the user must NOT be blocked nor able to probe
    // its existence via a 409 — they get a distinct, disambiguated id.
    selectQueue = [
      [{ id: 'legs' }], // muscle group validation
      [{ createdByUserId: null, isSystem: true }], // base id is a system preset
    ];
    insertHandler = (vals) => (vals['id'] === 'squat' ? [] : [buildInsertedRow(vals)]);

    const result = await createExercise('user-1', {
      id: 'squat',
      name: 'Squat',
      muscleGroupId: 'legs',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).not.toBe('squat');
    expect(result.value.id).toMatch(/^squat-[0-9a-f]{8}$/);
    expect(result.value.createdBy).toBe('user-1');
    expect(mockInvalidateUserExercises).toHaveBeenCalledTimes(1);
  });

  it('lets two different users create identically-named exercises with distinct ids', async () => {
    // --- User A is first: takes the base slug verbatim ---
    selectQueue = [[{ id: 'chest' }]]; // muscle group validation only
    insertHandler = (vals) => [buildInsertedRow(vals)]; // base slug is free

    const a = await createExercise('user-a', {
      id: 'bench_press',
      name: 'Bench Press',
      muscleGroupId: 'chest',
    });

    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.id).toBe('bench_press');
    expect(a.value.createdBy).toBe('user-a');

    // --- User B: same name; base slug now owned by A, not B ---
    selectQueue = [
      [{ id: 'chest' }], // muscle group validation
      [{ createdByUserId: 'user-a', isSystem: false }], // base id owned by A
    ];
    insertHandler = (vals) => (vals['id'] === 'bench_press' ? [] : [buildInsertedRow(vals)]);

    const b = await createExercise('user-b', {
      id: 'bench_press',
      name: 'Bench Press',
      muscleGroupId: 'chest',
    });

    expect(b.ok).toBe(true);
    if (!b.ok) return;
    // Distinct id, disambiguated, owned by B — each user's row is independent
    // and listExercises filters by createdByUserId, so each sees only their own.
    expect(b.value.id).toMatch(/^bench_press-[0-9a-f]{8}$/);
    expect(b.value.id).not.toBe(a.value.id);
    expect(b.value.createdBy).toBe('user-b');
  });
});

// ---------------------------------------------------------------------------
// listExercises — pagination (REQ-EXPAG-003)
// ---------------------------------------------------------------------------

describe('listExercises — pagination', () => {
  it('applies LIMIT and OFFSET and returns total count', async () => {
    // Arrange — data query returns 2 rows, count query returns 50
    selectQueue = [[PRESET_EXERCISE, USER_EXERCISE], [{ value: 50 }]];

    // Act
    const result = await listExercises(undefined, {}, { limit: 10, offset: 20 });

    // Assert
    expect(result.total).toBe(50);
    expect(result.data).toHaveLength(2);
    expect(result.offset).toBe(20);
    expect(result.limit).toBe(10);
  });

  it('rejects limit above the public route cap before cache or database work', async () => {
    try {
      await listExercises(undefined, {}, { limit: 1001, offset: 0 });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as InstanceType<typeof ApiError>).statusCode).toBe(400);
      expect((err as InstanceType<typeof ApiError>).code).toBe('INVALID_FILTER');
      expect(mockBuildFilterHash).not.toHaveBeenCalled();
      expect(mockGetCachedExercises).not.toHaveBeenCalled();
      expect(selectQueue).toHaveLength(0);
    }
  });
});
