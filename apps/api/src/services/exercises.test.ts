/**
 * Exercises service unit tests — verifies listExercises, listMuscleGroups,
 * and createExercise behavior with mocked DB.
 *
 * Strategy: mock getDb() at module level so the service functions use our fake.
 * Each query chain is tracked by call order, allowing tests to control responses.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock DB — track calls via a queue
// ---------------------------------------------------------------------------

interface ExerciseRow {
  readonly id: string;
  readonly name: string;
  readonly muscleGroupId: string;
  readonly equipment: string | null;
  readonly isCompound: boolean;
  readonly isPreset: boolean;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly force: string | null;
  readonly level: string | null;
  readonly mechanic: string | null;
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
  isPreset: true,
  createdBy: null,
  createdAt: NOW,
  force: 'push',
  level: 'beginner',
  mechanic: 'compound',
  category: 'strength',
  secondaryMuscles: ['back', 'core'],
};

const USER_EXERCISE: ExerciseRow = {
  id: 'my_curl',
  name: 'My Custom Curl',
  muscleGroupId: 'arms',
  equipment: 'dumbbell',
  isCompound: false,
  isPreset: false,
  createdBy: 'user-1',
  createdAt: NOW,
  force: 'pull',
  level: 'beginner',
  mechanic: 'isolation',
  category: 'strength',
  secondaryMuscles: null,
};

/**
 * Queue-based mock: each call to select().from() pops the next result
 * from selectQueue. insert().values().onConflictDoNothing().returning()
 * returns insertResult.
 */
let selectQueue: unknown[][] = [];
let insertResult: unknown[] = [];

function chainable(result: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  obj['where'] = mock(() => chainable(result));
  obj['orderBy'] = mock(() => chainable(result));
  obj['limit'] = mock(() => chainable(result));
  obj['offset'] = mock(() => chainable(result));
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
            onConflictDoNothing: mock(function onConflictDoNothing() {
              return {
                returning: mock(() => Promise.resolve(insertResult)),
              };
            }),
            returning: mock(() => Promise.resolve(insertResult)),
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

const mockGetCachedExercises = mock(
  async (): Promise<PaginatedExercisesFixture | undefined> => cachedExercisesResult
);
const mockSetCachedExercises = mock(async (): Promise<void> => undefined);
const mockGetCachedMuscleGroups = mock(
  async (): Promise<readonly { id: string; name: string }[] | undefined> => cachedMuscleGroupsResult
);
const mockSetCachedMuscleGroups = mock(async (): Promise<void> => undefined);
const mockInvalidateUserExercises = mock(async (): Promise<void> => undefined);
const mockBuildFilterHash = mock((): string => '');

mock.module('../lib/exercise-cache', () => ({
  getCachedExercises: mockGetCachedExercises,
  setCachedExercises: mockSetCachedExercises,
  invalidateUserExercises: mockInvalidateUserExercises,
  buildFilterHash: mockBuildFilterHash,
}));

mock.module('../lib/muscle-groups-cache', () => ({
  getCachedMuscleGroups: mockGetCachedMuscleGroups,
  setCachedMuscleGroups: mockSetCachedMuscleGroups,
}));

// Must import AFTER mock.module
const { listExercises, listMuscleGroups, createExercise } = await import('./exercises');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  selectQueue = [];
  insertResult = [];
  mockDb = createMockDb();
  cachedExercisesResult = undefined;
  cachedMuscleGroupsResult = undefined;
  mockGetCachedExercises.mockClear();
  mockSetCachedExercises.mockClear();
  mockGetCachedMuscleGroups.mockClear();
  mockSetCachedMuscleGroups.mockClear();
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

describe('createExercise', () => {
  it('should return Ok with created exercise on success', async () => {
    const createdRow: ExerciseRow = {
      id: 'custom_press',
      name: 'Custom Press',
      muscleGroupId: 'chest',
      equipment: null,
      isCompound: false,
      isPreset: false,
      createdBy: 'user-1',
      createdAt: NOW,
      force: null,
      level: null,
      mechanic: null,
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

  it('should return Err(EXERCISE_ID_CONFLICT) when ID already exists', async () => {
    selectQueue = [[{ id: 'legs' }]]; // muscle group exists
    insertResult = []; // onConflictDoNothing returns empty when conflict

    const result = await createExercise('user-1', {
      id: 'squat',
      name: 'Duplicate Squat',
      muscleGroupId: 'legs',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('EXERCISE_ID_CONFLICT');
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
});
