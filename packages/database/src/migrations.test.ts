import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from './migrations';

describe('program instance idempotency migrations', () => {
  it('persists the immutable creation intent after the creation key migration', async () => {
    const [migration, journal, snapshot] = await Promise.all([
      readFile(join(MIGRATIONS_DIR, '0045_glorious_skrulls.sql'), 'utf8'),
      readFile(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
      readFile(join(MIGRATIONS_DIR, 'meta', '0045_snapshot.json'), 'utf8'),
    ]);

    expect(migration).toContain(
      'ALTER TABLE "program_instances" ADD COLUMN "creation_intent" text;'
    );
    expect(journal).toContain('0045_glorious_skrulls');
    expect(snapshot).toContain('"creation_intent"');
  });
});
