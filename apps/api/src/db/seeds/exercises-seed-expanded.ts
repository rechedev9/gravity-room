/**
 * Idempotent seed for the expanded exercises dataset (675 exercises).
 * Imports a committed JSON asset and maps free-exercise-db muscle names
 * to the 8 existing muscle group IDs. Uses onConflictDoNothing() so the
 * 3 ID-clashing exercises (face_pull, triceps_pushdown, seated_leg_curl)
 * are silently skipped, preserving program-critical preset data.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { exercises } from '../schema';
import type * as schema from '../schema';
import { isRecord } from '@gzclp/shared/type-guards';
import rawData from './data/exercises-expanded.json';

type DbClient = PostgresJsDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Muscle group mapping (17 source names -> 8 existing IDs)
// ---------------------------------------------------------------------------

/** Exported for testing — verifies coverage of all 17 source muscle names. */
export const MUSCLE_GROUP_MAP: Readonly<Record<string, string>> = {
  abdominals: 'core',
  adductors: 'legs',
  abductors: 'legs',
  biceps: 'arms',
  calves: 'calves',
  chest: 'chest',
  forearms: 'arms',
  glutes: 'legs',
  hamstrings: 'legs',
  lats: 'back',
  'lower back': 'back',
  'middle back': 'back',
  neck: 'shoulders',
  quadriceps: 'legs',
  shoulders: 'shoulders',
  traps: 'back',
  triceps: 'arms',
};

// ---------------------------------------------------------------------------
// Type guard for raw JSON entries
// ---------------------------------------------------------------------------

interface ExpandedExerciseRaw {
  readonly id: string;
  readonly nameEs: string;
  readonly force: string | null;
  readonly level: string;
  readonly mechanic: string | null;
  readonly equipment: string | null;
  readonly primaryMuscles: readonly string[];
  readonly secondaryMuscles: readonly string[];
  readonly category: string;
}

/** Exported for testing — verifies type guard accepts/rejects raw entries. */
export function isExpandedExerciseRaw(value: unknown): value is ExpandedExerciseRaw {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.nameEs === 'string' &&
    typeof value.level === 'string' &&
    typeof value.category === 'string' &&
    Array.isArray(value.primaryMuscles) &&
    Array.isArray(value.secondaryMuscles)
  );
}

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

export async function seedExercisesExpanded(db: DbClient): Promise<void> {
  const data: unknown = rawData;
  if (!Array.isArray(data)) {
    throw new Error('exercises-expanded.json must be an array');
  }

  const rows = data.map((entry: unknown, idx: number) => {
    if (!isExpandedExerciseRaw(entry)) {
      throw new Error(`Invalid exercise entry at index ${idx}`);
    }

    const primaryMuscle = entry.primaryMuscles[0];
    if (typeof primaryMuscle !== 'string') {
      throw new Error(`Exercise "${entry.id}" has no primaryMuscles[0]`);
    }

    const muscleGroupId = MUSCLE_GROUP_MAP[primaryMuscle];
    if (!muscleGroupId) {
      throw new Error(`Exercise "${entry.id}" has unmapped muscle group: "${primaryMuscle}"`);
    }

    const secondaryMuscles = entry.secondaryMuscles
      .filter((m): m is string => typeof m === 'string' && m in MUSCLE_GROUP_MAP)
      .map((m) => MUSCLE_GROUP_MAP[m])
      .filter((id): id is string => typeof id === 'string');

    return {
      id: entry.id,
      name: entry.nameEs,
      muscleGroupId,
      equipment: entry.equipment,
      isCompound: entry.mechanic === 'compound',
      isPreset: true,
      createdBy: null,
      force: entry.force,
      level: entry.level,
      mechanic: entry.mechanic,
      category: entry.category,
      secondaryMuscles: secondaryMuscles.length > 0 ? secondaryMuscles : null,
    };
  });

  // Batch inserts to avoid exceeding query parameter limits (~8100 params at once).
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(exercises).values(batch).onConflictDoNothing();
  }
}
