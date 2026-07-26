import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { isRecord } from '@gzclp/domain/type-guards';
import { MIGRATIONS_DIR } from './migrations';
import {
  emailVerificationTokens,
  exercises,
  muscleGroups,
  passwordResetTokens,
  programDefinitions,
  programInstances,
  programTemplates,
  refreshTokens,
  undoEntries,
  userIdentities,
  userInsights,
  users,
  workoutResults,
} from './schema';

function parseLatestTag(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value['entries'])) {
    throw new Error('Invalid Drizzle migration journal');
  }
  const latest = value['entries'].at(-1);
  if (!isRecord(latest) || typeof latest['tag'] !== 'string') {
    throw new Error('Drizzle migration journal has no latest tag');
  }
  return latest['tag'];
}

function parseSnapshotTables(value: unknown): string[] {
  if (!isRecord(value) || !isRecord(value['tables'])) {
    throw new Error('Invalid Drizzle migration snapshot');
  }
  return Object.keys(value['tables']).sort();
}

describe('migration metadata', () => {
  it('keeps the latest snapshot aligned with every table in the TypeScript schema', async () => {
    const journal = JSON.parse(
      await readFile(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8')
    );
    const latestTag = parseLatestTag(journal);
    const migrationIndex = latestTag.split('_', 1)[0];
    if (!migrationIndex) throw new Error(`Invalid latest migration tag: ${latestTag}`);

    const snapshot = JSON.parse(
      await readFile(join(MIGRATIONS_DIR, 'meta', `${migrationIndex}_snapshot.json`), 'utf8')
    );
    const expectedTables = [
      emailVerificationTokens,
      exercises,
      muscleGroups,
      passwordResetTokens,
      programDefinitions,
      programInstances,
      programTemplates,
      refreshTokens,
      undoEntries,
      userIdentities,
      userInsights,
      users,
      workoutResults,
    ]
      .map((table) => `public.${getTableName(table)}`)
      .sort();

    expect(parseSnapshotTables(snapshot)).toEqual(expectedTables);
  });
});
