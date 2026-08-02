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

function parseSnapshotColumns(value: unknown, tableName: string): string[] {
  if (!isRecord(value) || !isRecord(value['tables'])) {
    throw new Error('Invalid Drizzle migration snapshot');
  }
  const table = value['tables'][tableName];
  if (!isRecord(table) || !isRecord(table['columns'])) {
    throw new Error(`Snapshot is missing ${tableName}`);
  }
  return Object.keys(table['columns']);
}

function parseSnapshotColumn(
  value: unknown,
  tableName: string,
  columnName: string
): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value['tables'])) {
    throw new Error('Invalid Drizzle migration snapshot');
  }
  const table = value['tables'][tableName];
  if (!isRecord(table) || !isRecord(table['columns'])) {
    throw new Error(`Snapshot is missing ${tableName}`);
  }
  const column = table['columns'][columnName];
  if (!isRecord(column)) throw new Error(`Snapshot is missing ${tableName}.${columnName}`);
  return column;
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

  it('tracks the versioned exercise identity columns used by analytics', async () => {
    const journal = JSON.parse(
      await readFile(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8')
    );
    const latestTag = parseLatestTag(journal);
    const migrationIndex = latestTag.split('_', 1)[0];
    if (!migrationIndex) throw new Error(`Invalid latest migration tag: ${latestTag}`);
    const snapshot = JSON.parse(
      await readFile(join(MIGRATIONS_DIR, 'meta', `${migrationIndex}_snapshot.json`), 'utf8')
    );

    expect(parseSnapshotColumns(snapshot, 'public.workout_results')).toEqual(
      expect.arrayContaining(['exercise_id', 'definition_version'])
    );
    expect(parseSnapshotColumns(snapshot, 'public.undo_entries')).toEqual(
      expect.arrayContaining(['previous_exercise_id', 'previous_definition_version'])
    );
  });

  it.each(['0044_snapshot.json', '0045_snapshot.json'])(
    'records the refresh-token family column as nullable during rollout in %s',
    async (snapshotName) => {
      const snapshot = JSON.parse(
        await readFile(join(MIGRATIONS_DIR, 'meta', snapshotName), 'utf8')
      );
      expect(parseSnapshotColumn(snapshot, 'public.refresh_tokens', 'family_id')).toMatchObject({
        notNull: false,
        default: 'gen_random_uuid()',
      });
    }
  );

  it('keeps migration 0044 compatible with the previously deployed writer', async () => {
    const migration = await readFile(join(MIGRATIONS_DIR, '0044_sweet_morg.sql'), 'utf8');
    const defaultPosition = migration.indexOf('ALTER COLUMN "family_id" SET DEFAULT');
    const backfillPosition = migration.indexOf('UPDATE "refresh_tokens"');

    expect(migration).not.toMatch(/family_id[^;]*SET NOT NULL/i);
    expect(defaultPosition).toBeGreaterThanOrEqual(0);
    expect(backfillPosition).toBeGreaterThan(defaultPosition);
  });

  it('keeps migration 0045 expand-only and defers historical validation', async () => {
    const migration = await readFile(join(MIGRATIONS_DIR, '0045_overrated_leech.sql'), 'utf8');

    expect(migration).not.toMatch(/\bUPDATE\s+"(?:workout_results|undo_entries)"/i);
    expect(migration).not.toContain('jsonb_array_elements');
    expect(migration.match(/NOT VALID;/g)).toHaveLength(4);
  });
});
