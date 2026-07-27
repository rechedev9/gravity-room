/**
 * Idempotent seed for the muscle_groups table.
 * Uses an upsert so corrected canonical labels reach existing databases.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
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
    .onConflictDoUpdate({
      target: muscleGroups.id,
      set: { name: sql`excluded.name` },
    });
}
