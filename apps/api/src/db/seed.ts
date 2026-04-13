/**
 * Dev seed script — creates a test user, sample program instance, and seed reference data.
 * Run with: bun run db:seed
 */
import { getDb } from './index';
import { users, programInstances } from './schema';
import { seedMuscleGroups } from './seeds/muscle-groups-seed';
import { seedExercises } from './seeds/exercises-seed';
import { seedProgramTemplates } from './seeds/program-templates-seed';
import { seedExercisesExpanded } from './seeds/exercises-seed-expanded';

async function seed(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('db:seed must not run in production');
  }

  const db = getDb();

  console.error('Seeding reference data (muscle_groups, exercises, program_templates)...');
  await seedMuscleGroups(db);
  await seedExercises(db);
  await seedExercisesExpanded(db);
  await seedProgramTemplates(db);
  console.error('Reference data seed complete.');

  console.error('Seeding test user...');
  const [user] = await db
    .insert(users)
    .values({
      email: 'test@example.com',
      googleId: 'dev-seed-google-id',
      name: 'Test User',
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.error('Test user already exists, skipping user seed.');
    process.exit(0);
    return;
  }

  // Create a sample GZCLP program instance
  await db.insert(programInstances).values({
    userId: user.id,
    programId: 'gzclp',
    name: 'My GZCLP Program',
    config: {
      squat: 100,
      bench: 60,
      deadlift: 100,
      ohp: 40,
      latpulldown: 40,
      dbrow: 20,
    },
    status: 'active',
  });

  console.error('Seed complete: reference data + test user + sample program created.');
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
