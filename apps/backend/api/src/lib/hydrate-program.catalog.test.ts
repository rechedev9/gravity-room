/**
 * Catalog integrity: every program the catalog declares must hydrate from the
 * exact rows the seeds write, so a listed program can always be opened.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect } from 'vitest';
import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';
import { PROGRAM_TEMPLATE_DEFINITIONS } from '@gzclp/database/seeds/program-templates-seed';
import { CANONICAL_EXERCISES } from '@gzclp/database/seeds/exercises-seed';
import { isExpandedExerciseRaw } from '@gzclp/database/seeds/exercises-seed-expanded';
import expandedExercises from '../../../../../packages/database/src/seeds/data/exercises-expanded.json';
import { buildProgramConfig } from '@gzclp/domain/program-config';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import { hydrateProgramDefinition, type ExerciseRow } from './hydrate-program';

// Canonical rows win over expanded ones, as in the seeds.
const seededExercises = new Map<string, ExerciseRow>();
for (const entry of expandedExercises) {
  if (isExpandedExerciseRaw(entry))
    seededExercises.set(entry.id, { id: entry.id, name: entry.nameEs });
}
for (const exercise of CANONICAL_EXERCISES) {
  seededExercises.set(exercise.id, { id: exercise.id, name: exercise.name });
}

describe('seeded catalog hydration', () => {
  it('seeds a definition for exactly the programs the catalog declares', () => {
    expect(Object.keys(PROGRAM_TEMPLATE_DEFINITIONS).sort()).toEqual(
      PROGRAM_CATALOG.map((meta) => meta.id).sort()
    );
  });

  it.each(PROGRAM_CATALOG.map((meta) => [meta.id, meta] as const))(
    'hydrates %s from its seeded row',
    (_id, meta) => {
      const result = hydrateProgramDefinition(
        {
          id: meta.id,
          name: meta.name,
          description: meta.description,
          author: meta.author,
          version: 1,
          category: meta.category,
          source: 'preset',
          definition: PROGRAM_TEMPLATE_DEFINITIONS[meta.id],
        },
        [...seededExercises.values()]
      );

      expect(result.ok ? 'ok' : result.error).toBe('ok');
    }
  );

  // isWorkoutComplete/findFirstPendingIndex treat a zero-slot row as pending;
  // that only matches the old per-app copies if no seeded program produces one.
  it.each(PROGRAM_CATALOG.map((meta) => [meta.id, meta] as const))(
    'computes %s with at least one slot in every workout row',
    (_id, meta) => {
      const result = hydrateProgramDefinition(
        {
          id: meta.id,
          name: meta.name,
          description: meta.description,
          author: meta.author,
          version: 1,
          category: meta.category,
          source: 'preset',
          definition: PROGRAM_TEMPLATE_DEFINITIONS[meta.id],
        },
        [...seededExercises.values()]
      );
      if (!result.ok) throw new Error(JSON.stringify(result.error));

      const rows = computeGenericProgram(result.value, buildProgramConfig(result.value), {});
      expect(rows.length).toBeGreaterThan(0);
      const empty = rows.filter((row) => row.slots.length === 0).map((row) => row.index);
      expect(empty).toEqual([]);
    }
  );
});
