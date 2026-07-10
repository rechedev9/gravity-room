/**
 * Exercises service — CRUD for exercises and muscle groups.
 * Framework-agnostic: no Elysia dependency.
 */
import { and, asc, count, eq, ilike, inArray, or } from 'drizzle-orm';
import { getDb } from '../db';
import { exercises, muscleGroups } from '@gzclp/database/schema';
import {
  buildFilterHash,
  getCachedExercises,
  setCachedExercises,
  invalidateUserExercises,
} from '../lib/exercise-cache';
import { getCachedMuscleGroups, setCachedMuscleGroups } from '../lib/muscle-groups-cache';
import { SingleflightMap } from '../lib/singleflight';
import { type Result, ok, err } from '../lib/result';
import { ApiError } from '../middleware/error-handler';

// Singleflight instances — one per return type for type safety
const exerciseFlight = new SingleflightMap<PaginatedExercises>();
const muscleGroupFlight = new SingleflightMap<readonly MuscleGroupEntry[]>();

/** Default pagination values when pagination is not explicitly provided. */
const DEFAULT_PAGINATION: PaginationParams = { limit: 100, offset: 0 };
const MIN_EXERCISE_LIMIT = 1;
const MAX_EXERCISE_LIMIT = 1000;
const MIN_EXERCISE_OFFSET = 0;
const MAX_EXERCISE_OFFSET = 10_000;
const MAX_SEARCH_QUERY_LENGTH = 100;
const MAX_FILTER_VALUES = 20;
const MAX_FILTER_VALUE_LENGTH = 80;
const MAX_CREATE_EXERCISE_ID_LENGTH = 50;
const MAX_CREATE_EXERCISE_NAME_LENGTH = 100;
const MAX_CREATE_EXERCISE_MUSCLE_GROUP_ID_LENGTH = 50;
const MAX_CREATE_EXERCISE_EQUIPMENT_LENGTH = 50;
/**
 * When a user's base slug id collides with a row they do NOT own (a system
 * preset or another user's custom exercise), we retry the insert with a short
 * random disambiguator appended. Bounded so a pathological run of UUID
 * collisions can never loop forever.
 */
const MAX_DISAMBIGUATION_ATTEMPTS = 5;
/** Length of the random suffix appended to disambiguate a squatted slug. */
const DISAMBIGUATOR_LENGTH = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExerciseEntry {
  readonly id: string;
  readonly name: string;
  readonly muscleGroupId: string;
  readonly equipment: string | null;
  readonly isCompound: boolean;
  readonly isPreset: boolean;
  readonly createdBy: string | null;
  readonly force: string | null;
  readonly level: string | null;
  readonly mechanic: string | null;
  readonly category: string | null;
  readonly secondaryMuscles: readonly string[] | null;
}

export interface MuscleGroupEntry {
  readonly id: string;
  readonly name: string;
}

/** Paginated exercise list response. */
export interface PaginatedExercises {
  readonly data: readonly ExerciseEntry[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

/** Pagination parameters for listExercises. */
export interface PaginationParams {
  readonly limit: number;
  readonly offset: number;
}

export interface ExerciseFilter {
  readonly q?: string;
  readonly muscleGroupId?: readonly string[];
  readonly equipment?: readonly string[];
  readonly force?: readonly string[];
  readonly level?: readonly string[];
  readonly mechanic?: readonly string[];
  readonly category?: readonly string[];
  readonly isCompound?: boolean;
}

export interface CreateExerciseInput {
  readonly id: string;
  readonly name: string;
  readonly muscleGroupId: string;
  readonly equipment?: string;
  readonly isCompound?: boolean;
}

interface ExerciseConflictError {
  readonly code: 'EXERCISE_ID_CONFLICT';
}

interface InvalidMuscleGroupError {
  readonly code: 'INVALID_MUSCLE_GROUP';
}

interface InvalidExerciseInputError {
  readonly code: 'INVALID_EXERCISE_INPUT';
}

export type CreateExerciseError =
  | ExerciseConflictError
  | InvalidMuscleGroupError
  | InvalidExerciseInputError;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape special LIKE/ILIKE characters so user input is treated as literal. */
function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function assertPaginationInRange(page: PaginationParams): void {
  if (
    !Number.isInteger(page.limit) ||
    page.limit < MIN_EXERCISE_LIMIT ||
    page.limit > MAX_EXERCISE_LIMIT
  ) {
    throw new ApiError(400, 'Invalid exercise limit', 'INVALID_FILTER');
  }
  if (
    !Number.isInteger(page.offset) ||
    page.offset < MIN_EXERCISE_OFFSET ||
    page.offset > MAX_EXERCISE_OFFSET
  ) {
    throw new ApiError(400, 'Invalid exercise offset', 'INVALID_FILTER');
  }
}

function assertFilterValuesInRange(values: readonly string[] | undefined): void {
  if (values === undefined) return;
  if (values.length > MAX_FILTER_VALUES) {
    throw new ApiError(400, 'Too many exercise filter values', 'INVALID_FILTER');
  }
  if (values.some((value) => value.length > MAX_FILTER_VALUE_LENGTH)) {
    throw new ApiError(400, 'Exercise filter value is too long', 'INVALID_FILTER');
  }
}

function assertFilterInRange(filter: ExerciseFilter | undefined): void {
  if (filter?.q !== undefined && filter.q.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new ApiError(400, 'Invalid exercise search query', 'INVALID_FILTER');
  }
  assertFilterValuesInRange(filter?.muscleGroupId);
  assertFilterValuesInRange(filter?.equipment);
  assertFilterValuesInRange(filter?.force);
  assertFilterValuesInRange(filter?.level);
  assertFilterValuesInRange(filter?.mechanic);
  assertFilterValuesInRange(filter?.category);
}

function isCreateExerciseInputInvalid(input: CreateExerciseInput): boolean {
  return (
    input.id.length < 1 ||
    input.id.length > MAX_CREATE_EXERCISE_ID_LENGTH ||
    input.name.length < 1 ||
    input.name.length > MAX_CREATE_EXERCISE_NAME_LENGTH ||
    input.muscleGroupId.length < 1 ||
    input.muscleGroupId.length > MAX_CREATE_EXERCISE_MUSCLE_GROUP_ID_LENGTH ||
    (input.equipment !== undefined && input.equipment.length > MAX_CREATE_EXERCISE_EQUIPMENT_LENGTH)
  );
}

function toExerciseEntry(row: typeof exercises.$inferSelect): ExerciseEntry {
  return {
    id: row.id,
    name: row.name,
    muscleGroupId: row.muscleGroupId,
    equipment: row.equipment,
    isCompound: row.isCompound,
    isPreset: row.isSystem,
    createdBy: row.createdByUserId,
    force: row.forceType ?? null,
    level: row.level ?? null,
    mechanic: row.movementMechanic ?? null,
    category: row.category ?? null,
    secondaryMuscles: row.secondaryMuscles ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List exercises accessible to the caller, with optional filtering and pagination.
 * - If userId is undefined: return preset exercises only.
 * - If userId is provided: return preset + user's own custom exercises.
 * - Filter fields narrow the result set further (all conditions are AND-ed).
 * - Pagination defaults to limit=100, offset=0 when not provided.
 */
export async function listExercises(
  userId: string | undefined,
  filter?: ExerciseFilter,
  pagination?: PaginationParams
): Promise<PaginatedExercises> {
  const page = pagination ?? DEFAULT_PAGINATION;
  assertPaginationInRange(page);
  assertFilterInRange(filter);

  // Include pagination in filter hash so different pages cache independently
  const filterForHash: Record<string, unknown> = {
    ...filter,
    limit: page.limit,
    offset: page.offset,
  };
  const filterHash = buildFilterHash(filterForHash);

  // Check cache first — fast path avoids singleflight overhead
  const cached = await getCachedExercises(userId, filterHash);
  if (cached) return cached;

  // Singleflight key includes userId + filterHash for per-query deduplication
  const sfKey = `exercises:${userId ?? 'preset'}:${filterHash}`;

  return exerciseFlight.run(sfKey, async () => {
    // Re-check cache — another caller may have populated it while we waited
    const rechecked = await getCachedExercises(userId, filterHash);
    if (rechecked) return rechecked;

    const conditions = [
      userId
        ? or(eq(exercises.isSystem, true), eq(exercises.createdByUserId, userId))
        : eq(exercises.isSystem, true),
    ];

    if (filter?.q) {
      conditions.push(ilike(exercises.name, `%${escapeLikePattern(filter.q)}%`));
    }
    if (filter?.muscleGroupId && filter.muscleGroupId.length > 0) {
      conditions.push(inArray(exercises.muscleGroupId, [...filter.muscleGroupId]));
    }
    if (filter?.equipment && filter.equipment.length > 0) {
      conditions.push(inArray(exercises.equipment, [...filter.equipment]));
    }
    if (filter?.force && filter.force.length > 0) {
      conditions.push(inArray(exercises.forceType, [...filter.force]));
    }
    if (filter?.level && filter.level.length > 0) {
      conditions.push(inArray(exercises.level, [...filter.level]));
    }
    if (filter?.mechanic && filter.mechanic.length > 0) {
      conditions.push(inArray(exercises.movementMechanic, [...filter.mechanic]));
    }
    if (filter?.category && filter.category.length > 0) {
      conditions.push(inArray(exercises.category, [...filter.category]));
    }
    if (filter?.isCompound !== undefined) {
      conditions.push(eq(exercises.isCompound, filter.isCompound));
    }

    const whereClause = and(...conditions);
    const db = getDb();

    // Run paginated data query and total count query in parallel
    const [rows, [countResult]] = await Promise.all([
      db
        .select()
        .from(exercises)
        .where(whereClause)
        .orderBy(asc(exercises.name))
        .limit(page.limit)
        .offset(page.offset),
      db.select({ value: count() }).from(exercises).where(whereClause),
    ]);

    const result: PaginatedExercises = {
      data: rows.map(toExerciseEntry),
      total: countResult?.value ?? 0,
      offset: page.offset,
      limit: page.limit,
    };

    // Populate cache (fire-and-forget)
    void setCachedExercises(userId, filterHash, result);

    return result;
  });
}

/** List all muscle groups. */
export async function listMuscleGroups(): Promise<readonly MuscleGroupEntry[]> {
  // Check cache first — fast path
  const cached = await getCachedMuscleGroups();
  if (cached) return cached;

  return muscleGroupFlight.run('list', async () => {
    const rechecked = await getCachedMuscleGroups();
    if (rechecked) return rechecked;

    const rows = await getDb()
      .select({ id: muscleGroups.id, name: muscleGroups.name })
      .from(muscleGroups);

    // Populate cache (fire-and-forget)
    void setCachedMuscleGroups(rows);

    return rows;
  });
}

/**
 * Create a user-scoped exercise.
 *
 * The primary key is the name-derived slug, which is GLOBAL. To keep one user
 * from squatting a name (and to stop existence-probing via a 409), a collision
 * with a row this user does NOT own — a system preset or another user's custom
 * exercise — transparently retries under a disambiguated id rather than failing.
 * `EXERCISE_ID_CONFLICT` is returned only when the SAME user already owns an
 * exercise with that exact base id (a genuine duplicate for them). The returned
 * entry always carries the id that was actually inserted.
 */
export async function createExercise(
  userId: string,
  input: CreateExerciseInput
): Promise<Result<ExerciseEntry, CreateExerciseError>> {
  if (isCreateExerciseInputInvalid(input)) {
    return err({ code: 'INVALID_EXERCISE_INPUT' });
  }

  // Validate muscle group exists
  const [mg] = await getDb()
    .select({ id: muscleGroups.id })
    .from(muscleGroups)
    .where(eq(muscleGroups.id, input.muscleGroupId))
    .limit(1);

  if (!mg) {
    return err({ code: 'INVALID_MUSCLE_GROUP' });
  }

  // Insert the row under a specific id. `onConflictDoNothing` returns the
  // inserted row, or nothing when a row with that id already exists.
  async function insertWithId(id: string): Promise<typeof exercises.$inferSelect | undefined> {
    const [row] = await getDb()
      .insert(exercises)
      .values({
        id,
        name: input.name,
        muscleGroupId: input.muscleGroupId,
        equipment: input.equipment ?? null,
        isCompound: input.isCompound ?? false,
        isSystem: false,
        createdByUserId: userId,
      })
      .onConflictDoNothing()
      .returning();
    return row;
  }

  // Fast path: the base slug is free — take it verbatim.
  const inserted = await insertWithId(input.id);
  if (inserted) {
    // Invalidate user-specific exercise cache (fire-and-forget)
    void invalidateUserExercises(userId);
    return ok(toExerciseEntry(inserted));
  }

  // The base slug id is a GLOBAL primary key that is already taken. The id is
  // name-derived, so this collision is expected across users. Look up who owns
  // the existing row to decide whether this is a genuine duplicate for THIS
  // user or a foreign owner squatting the slug.
  const [existing] = await getDb()
    .select({ createdByUserId: exercises.createdByUserId, isSystem: exercises.isSystem })
    .from(exercises)
    .where(eq(exercises.id, input.id))
    .limit(1);

  // Same user already owns a custom exercise with this exact base id — a real
  // duplicate for them. (A row can vanish between the insert and this read; if
  // so, `existing` is undefined and we fall through to the retry path, which
  // will simply succeed on the base id.)
  if (existing && !existing.isSystem && existing.createdByUserId === userId) {
    return err({ code: 'EXERCISE_ID_CONFLICT' });
  }

  // A system preset or another user owns the base slug. Neither should block
  // this user or let them probe existence via a 409 — mint a unique id by
  // appending a short random disambiguator and retry (bounded).
  for (let attempt = 0; attempt < MAX_DISAMBIGUATION_ATTEMPTS; attempt++) {
    const candidateId = `${input.id}-${crypto.randomUUID().slice(0, DISAMBIGUATOR_LENGTH)}`;
    const disambiguated = await insertWithId(candidateId);
    if (disambiguated) {
      // Invalidate user-specific exercise cache (fire-and-forget)
      void invalidateUserExercises(userId);
      return ok(toExerciseEntry(disambiguated));
    }
  }

  // Exhausted all disambiguation attempts (astronomically unlikely). Surface a
  // conflict rather than looping forever.
  return err({ code: 'EXERCISE_ID_CONFLICT' });
}
