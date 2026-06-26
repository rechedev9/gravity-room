/**
 * Standalone script to refresh program_templates definitions JSONB.
 * Safe to run in any environment — uses onConflictDoUpdate (idempotent).
 * Usage: pnpm --filter api db:update-definitions
 */
import { getDb } from '../db';
import { seedProgramTemplates } from '@gzclp/database/seeds/program-templates-seed';

async function run(): Promise<void> {
  const db = getDb();
  console.error('Updating program_templates definitions...');
  await seedProgramTemplates(db);
  console.error('Done.');
  process.exit(0);
}

run().catch((err: unknown) => {
  console.error('Update failed:', err);
  if (err instanceof Error && err.cause) {
    console.error('Cause:', err.cause);
  }
  process.exit(1);
});
