/**
 * Exercises service — CRUD for exercises and muscle groups.
 * Framework-agnostic: no Elysia dependency.
 */
import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm';
import { getDb } from '../db';
import { exercises, muscleGroups } from '../db/schema';

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

export type CreateExerciseError = ExerciseConflictError | InvalidMuscleGroupError;

// ---------------------------------------------------------------------------
// Result type (same pattern as hydrate-program.ts)
// ---------------------------------------------------------------------------

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

type Result<T, E> = Ok<T> | Err<E>;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape special LIKE/ILIKE characters so user input is treated as literal. */
function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function toExerciseEntry(row: typeof exercises.$inferSelect): ExerciseEntry {
  return {
    id: row.id,
    name: row.name,
    muscleGroupId: row.muscleGroupId,
    equipment: row.equipment,
    isCompound: row.isCompound,
    isPreset: row.isPreset,
    createdBy: row.createdBy,
    force: row.force ?? null,
    level: row.level ?? null,
    mechanic: row.mechanic ?? null,
    category: row.category ?? null,
    secondaryMuscles: row.secondaryMuscles ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List exercises accessible to the caller, with optional filtering.
 * - If userId is undefined: return preset exercises only.
 * - If userId is provided: return preset + user's own custom exercises.
 * - Filter fields narrow the result set further (all conditions are AND-ed).
 */
export async function listExercises(
  userId: string | undefined,
  filter?: ExerciseFilter
): Promise<readonly ExerciseEntry[]> {
  const conditions = [
    userId
      ? or(eq(exercises.isPreset, true), eq(exercises.createdBy, userId))
      : eq(exercises.isPreset, true),
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
    conditions.push(inArray(exercises.force, [...filter.force]));
  }
  if (filter?.level && filter.level.length > 0) {
    conditions.push(inArray(exercises.level, [...filter.level]));
  }
  if (filter?.mechanic && filter.mechanic.length > 0) {
    conditions.push(inArray(exercises.mechanic, [...filter.mechanic]));
  }
  if (filter?.category && filter.category.length > 0) {
    conditions.push(inArray(exercises.category, [...filter.category]));
  }
  if (filter?.isCompound !== undefined) {
    conditions.push(eq(exercises.isCompound, filter.isCompound));
  }

  const rows = await getDb()
    .select()
    .from(exercises)
    .where(and(...conditions))
    .orderBy(asc(exercises.name));

  return rows.map(toExerciseEntry);
}

/** List all muscle groups. */
export async function listMuscleGroups(): Promise<readonly MuscleGroupEntry[]> {
  const rows = await getDb()
    .select({ id: muscleGroups.id, name: muscleGroups.name })
    .from(muscleGroups);

  return rows;
}

/** Create a user-scoped exercise. Returns a typed error on conflict or invalid muscle group. */
export async function createExercise(
  userId: string,
  input: CreateExerciseInput
): Promise<Result<ExerciseEntry, CreateExerciseError>> {
  // Validate muscle group exists
  const [mg] = await getDb()
    .select({ id: muscleGroups.id })
    .from(muscleGroups)
    .where(eq(muscleGroups.id, input.muscleGroupId))
    .limit(1);

  if (!mg) {
    return err({ code: 'INVALID_MUSCLE_GROUP' });
  }

  // Attempt insert — ON CONFLICT means the ID is taken
  const [inserted] = await getDb()
    .insert(exercises)
    .values({
      id: input.id,
      name: input.name,
      muscleGroupId: input.muscleGroupId,
      equipment: input.equipment ?? null,
      isCompound: input.isCompound ?? false,
      isPreset: false,
      createdBy: userId,
    })
    .onConflictDoNothing()
    .returning();

  if (!inserted) {
    return err({ code: 'EXERCISE_ID_CONFLICT' });
  }

  return ok(toExerciseEntry(inserted));
}
