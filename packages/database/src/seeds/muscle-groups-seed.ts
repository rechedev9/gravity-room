/**
 * Idempotent seed for the muscle_groups table.
 * Uses onConflictDoNothing() to allow re-runs without error.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { muscleGroups } from '../schema';
import type * as schema from '../schema';

type DbClient = PostgresJsDatabase<typeof schema>;

const MUSCLE_GROUPS = [
  { id: 'chest', name: 'Pecho' },
  { id: 'back', name: 'Espalda' },
  { id: 'shoulders', name: 'Hombros' },
  { id: 'legs', name: 'Piernas' },
  { id: 'arms', name: 'Brazos' },
  { id: 'core', name: 'Core' },
  { id: 'full_body', name: 'Cuerpo Completo' },
  { id: 'calves', name: 'Gemelos' },
] as const;

export async function seedMuscleGroups(db: DbClient): Promise<void> {
  await db
    .insert(muscleGroups)
    .values([...MUSCLE_GROUPS])
    .onConflictDoNothing();
}
