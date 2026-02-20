/**
 * Dev seed script — creates a test user and sample program instance.
 * Run with: bun run db:seed
 */
import { getDb } from './index';
import { users, programInstances } from './schema';

async function seed(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('db:seed must not run in production');
  }

  console.error('Seeding database...');

  const [user] = await getDb()
    .insert(users)
    .values({
      email: 'test@example.com',
      googleId: 'dev-seed-google-id',
      name: 'Test User',
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.error('Test user already exists, skipping seed.');
    return;
  }

  // Create a sample GZCLP program instance
  await getDb()
    .insert(programInstances)
    .values({
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

  console.error('Seed complete: test user + sample program created.');
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
