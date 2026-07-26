/**
 * Seeds idempotency integration test.
 *
 * IMPORTANT: This test requires a running PostgreSQL database with all
 * migrations applied. It is SKIPPED by default in unit test runs.
 * To run it manually:
 *   RUN_DB_SEED_INTEGRATION=true DATABASE_URL=... vitest run src/seeds/seeds.test.ts
 *
 * Verifies REQ-DATA-004: running seeds twice produces the same counts
 * with no errors (idempotent via onConflictDoNothing).
 */
process.env['LOG_LEVEL'] = 'silent';

import { afterAll, describe, it, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../schema';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import { SHEIKO_7_1_DEFINITION } from './programs/sheiko-7-1';
import { SHEIKO_7_2_DEFINITION } from './programs/sheiko-7-2';
import { SHEIKO_7_3_DEFINITION } from './programs/sheiko-7-3';
import { SHEIKO_7_4_DEFINITION } from './programs/sheiko-7-4';
import { SHEIKO_7_5_DEFINITION } from './programs/sheiko-7-5';

// ---------------------------------------------------------------------------
// Sheiko seed schema validation (REQ-SEED-008)
// ---------------------------------------------------------------------------
describe('Sheiko seed schema validation', () => {
  const sheikoDefinitions = [
    { name: 'Sheiko 7.1', def: SHEIKO_7_1_DEFINITION },
    { name: 'Sheiko 7.2', def: SHEIKO_7_2_DEFINITION },
    { name: 'Sheiko 7.3', def: SHEIKO_7_3_DEFINITION },
    { name: 'Sheiko 7.4', def: SHEIKO_7_4_DEFINITION },
    { name: 'Sheiko 7.5', def: SHEIKO_7_5_DEFINITION },
  ];

  for (const { name, def } of sheikoDefinitions) {
    it(`${name} passes ProgramDefinitionSchema with zero errors`, () => {
      const result = ProgramDefinitionSchema.safeParse(def);

      if (!result.success) {
        console.error(`${name} failed:`, JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });
  }
});

// Integration tests are opt-in: CI may set DATABASE_URL before migrations run.
const hasDb =
  process.env['RUN_DB_SEED_INTEGRATION'] === 'true' &&
  typeof process.env['DATABASE_URL'] === 'string' &&
  process.env['DATABASE_URL'] !== '';
const integrationDatabaseName = process.env['DATABASE_URL']
  ? new URL(process.env['DATABASE_URL']).pathname.slice(1)
  : '';
const hasIsolatedDb = hasDb && integrationDatabaseName.startsWith('gravity_room_qa_');

type SeedTestDb = ReturnType<typeof drizzle<typeof schema>>;
let seedClient: postgres.Sql | undefined;
let seedDb: SeedTestDb | undefined;

function getSeedTestDb(): SeedTestDb {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required for seed integration tests');
  if (!seedDb) {
    seedClient = postgres(url, { max: 5 });
    seedDb = drizzle(seedClient, { schema });
  }
  return seedDb;
}

afterAll(async () => {
  await seedClient?.end();
});

describe.skipIf(!hasDb)('seeds idempotency (integration)', () => {
  it('should run muscle-groups seed twice without error', async () => {
    const { seedMuscleGroups } = await import('./muscle-groups-seed');
    const db = getSeedTestDb();

    // First run
    await seedMuscleGroups(db);

    // Second run — idempotent, should not throw
    await expect(seedMuscleGroups(db)).resolves.toBeUndefined();
  });

  it('should run exercises seed twice without error', async () => {
    const { seedExercises } = await import('./exercises-seed');
    const db = getSeedTestDb();

    await seedExercises(db);
    await expect(seedExercises(db)).resolves.toBeUndefined();
  });

  it('should run exercises-expanded seed twice without error', async () => {
    const { seedExercisesExpanded } = await import('./exercises-seed-expanded');
    const db = getSeedTestDb();

    await seedExercisesExpanded(db);
    await expect(seedExercisesExpanded(db)).resolves.toBeUndefined();
  });

  it('should run program-templates seed twice without error', async () => {
    const { seedProgramTemplates } = await import('./program-templates-seed');
    const db = getSeedTestDb();

    await seedProgramTemplates(db);
    await expect(seedProgramTemplates(db)).resolves.toBeUndefined();
  });

  it('should produce consistent counts across runs', async () => {
    const { seedMuscleGroups } = await import('./muscle-groups-seed');
    const { seedExercises } = await import('./exercises-seed');
    const { seedExercisesExpanded } = await import('./exercises-seed-expanded');
    const { seedProgramTemplates } = await import('./program-templates-seed');
    const { muscleGroups, exercises, programTemplates } = schema;
    const { count } = await import('drizzle-orm');
    const db = getSeedTestDb();

    // Run all seeds
    await seedMuscleGroups(db);
    await seedExercises(db);
    await seedExercisesExpanded(db);
    await seedProgramTemplates(db);

    // Count after first run
    const [mgCount1] = await db.select({ count: count() }).from(muscleGroups);
    const [exCount1] = await db.select({ count: count() }).from(exercises);
    const [ptCount1] = await db.select({ count: count() }).from(programTemplates);

    // Run again
    await seedMuscleGroups(db);
    await seedExercises(db);
    await seedExercisesExpanded(db);
    await seedProgramTemplates(db);

    // Count after second run
    const [mgCount2] = await db.select({ count: count() }).from(muscleGroups);
    const [exCount2] = await db.select({ count: count() }).from(exercises);
    const [ptCount2] = await db.select({ count: count() }).from(programTemplates);

    // Counts should be identical
    expect(mgCount2?.count).toBe(mgCount1?.count);
    expect(exCount2?.count).toBe(exCount1?.count);
    expect(ptCount2?.count).toBe(ptCount1?.count);
  });

  it('repairs stale canonical and expanded reference metadata on rerun', async () => {
    const { seedMuscleGroups } = await import('./muscle-groups-seed');
    const { seedExercises } = await import('./exercises-seed');
    const { seedExercisesExpanded } = await import('./exercises-seed-expanded');
    const { muscleGroups, exercises } = schema;
    const db = getSeedTestDb();

    await db.update(muscleGroups).set({ name: 'stale-label' }).where(eq(muscleGroups.id, 'chest'));
    await db
      .update(exercises)
      .set({ name: 'stale-canonical', equipment: 'machine', isCompound: false })
      .where(eq(exercises.id, 'squat'));
    await db
      .update(exercises)
      .set({ name: 'stale-expanded', level: 'expert' })
      .where(eq(exercises.id, '3_4_sit_up'));

    await seedMuscleGroups(db);
    await seedExercises(db);
    await seedExercisesExpanded(db);

    const [chest] = await db.select().from(muscleGroups).where(eq(muscleGroups.id, 'chest'));
    const [squat] = await db.select().from(exercises).where(eq(exercises.id, 'squat'));
    const [expanded] = await db.select().from(exercises).where(eq(exercises.id, '3_4_sit_up'));

    expect(chest?.name).toBe('Pecho');
    expect(squat).toMatchObject({
      name: 'Sentadilla',
      equipment: 'barbell',
      isCompound: true,
    });
    expect(expanded).toMatchObject({
      name: 'Abdominal 3/4',
      level: 'beginner',
    });
  });

  it('does not overwrite a custom exercise that collides with a reference ID', async () => {
    const { seedExercisesExpanded } = await import('./exercises-seed-expanded');
    const { exercises } = schema;
    const db = getSeedTestDb();

    await db
      .update(exercises)
      .set({ name: 'Personal collision', isSystem: false })
      .where(eq(exercises.id, '3_4_sit_up'));
    await seedExercisesExpanded(db);

    const [custom] = await db.select().from(exercises).where(eq(exercises.id, '3_4_sit_up'));
    expect(custom).toMatchObject({ name: 'Personal collision', isSystem: false });

    // Restore the isolated fixture for repeatability.
    await db.update(exercises).set({ isSystem: true }).where(eq(exercises.id, '3_4_sit_up'));
    await seedExercisesExpanded(db);
  });

  it.skipIf(!hasIsolatedDb)(
    'rolls back user-program changes when the catalog upsert fails',
    async () => {
      const { seedProgramTemplates } = await import('./program-templates-seed');
      const { users, programInstances } = schema;
      const db = getSeedTestDb();
      const client = seedClient;
      if (!client) throw new Error('Seed integration client was not initialized');

      const [user] = await db
        .insert(users)
        .values({ email: `qa8-seed-rollback-${Date.now()}@example.test` })
        .returning({ id: users.id });
      if (!user) throw new Error('Failed to create seed rollback fixture');
      await db.insert(programInstances).values({
        userId: user.id,
        templateId: '365-programmare-lipertrofia',
        name: 'Seed rollback fixture',
        programConfig: {},
        status: 'active',
      });

      await client`CREATE OR REPLACE FUNCTION qa8_reject_template_seed()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'qa8 forced seed failure';
      END;
      $$ LANGUAGE plpgsql`;
      await client`CREATE TRIGGER qa8_reject_template_seed_trigger
      BEFORE UPDATE ON program_templates
      FOR EACH STATEMENT EXECUTE FUNCTION qa8_reject_template_seed()`;

      try {
        await expect(seedProgramTemplates(db)).rejects.toThrow();
        const [instance] = await db
          .select({ status: programInstances.status })
          .from(programInstances)
          .where(eq(programInstances.userId, user.id));
        expect(instance?.status).toBe('active');
      } finally {
        await client`DROP TRIGGER IF EXISTS qa8_reject_template_seed_trigger ON program_templates`;
        await client`DROP FUNCTION IF EXISTS qa8_reject_template_seed()`;
        await db.delete(users).where(eq(users.id, user.id));
      }
    }
  );
});
