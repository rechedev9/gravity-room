import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';
import { expect, it } from 'vitest';
import { MAX_REPS } from '@gzclp/domain/schemas/instance';
import { MIGRATIONS_DIR } from './migrations';

const connectionUrl = process.env['PG_CONTRACT_TEST_URL'];

it.skipIf(!connectionUrl)(
  'upgrades both rep constraints without losing rows or weakening bounds',
  async () => {
    if (!connectionUrl) throw new Error('PG_CONTRACT_TEST_URL is required');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionUrl).hostname)) {
      throw new Error('Constraint verification requires a local PostgreSQL fixture');
    }
    const sql = postgres(connectionUrl, { max: 1 });
    try {
      const migration = await readFile(
        join(MIGRATIONS_DIR, '0047_daily_spencer_smythe.sql'),
        'utf8'
      );
      await sql.begin(async (tx) => {
        // Restrict lookup to this connection's disposable tables, even when the
        // local database also contains application tables with the same names.
        await tx`SET LOCAL search_path TO pg_temp, pg_catalog`;
        await tx`CREATE TEMP TABLE workout_results (
        amrap_reps smallint,
        CONSTRAINT chk_workout_results_amrap_reps CHECK (amrap_reps BETWEEN 0 AND 99)
      ) ON COMMIT DROP`;
        await tx`CREATE TEMP TABLE undo_entries (
        previous_amrap_reps smallint,
        CONSTRAINT chk_undo_entries_previous_amrap_reps CHECK (previous_amrap_reps BETWEEN 0 AND 99)
      ) ON COMMIT DROP`;
        await tx`INSERT INTO workout_results VALUES (99)`;
        await tx`INSERT INTO undo_entries VALUES (99)`;
        await tx.unsafe(migration);
        await tx`INSERT INTO workout_results VALUES (${MAX_REPS}), (NULL)`;
        await tx`INSERT INTO undo_entries VALUES (${MAX_REPS}), (NULL)`;
        for (const invalid of [-1, MAX_REPS + 1]) {
          await expect(
            tx.savepoint((sp) => sp`INSERT INTO workout_results VALUES (${invalid})`)
          ).rejects.toMatchObject({ code: '23514' });
          await expect(
            tx.savepoint((sp) => sp`INSERT INTO undo_entries VALUES (${invalid})`)
          ).rejects.toMatchObject({ code: '23514' });
        }
        expect(await tx`SELECT amrap_reps FROM workout_results ORDER BY amrap_reps`).toEqual([
          { amrap_reps: 99 },
          { amrap_reps: MAX_REPS },
          { amrap_reps: null },
        ]);
        expect(
          await tx`SELECT previous_amrap_reps FROM undo_entries ORDER BY previous_amrap_reps`
        ).toEqual([
          { previous_amrap_reps: 99 },
          { previous_amrap_reps: MAX_REPS },
          { previous_amrap_reps: null },
        ]);
      });
    } finally {
      await sql.end();
    }
  }
);
