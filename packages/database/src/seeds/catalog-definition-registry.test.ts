import { describe, expect, it } from 'vitest';
import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import { CATALOG_DEFINITION_JSONB_BY_ID } from './catalog-definition-registry';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectExerciseIds(definition: Record<string, unknown>): ReadonlySet<string> {
  const exerciseIds = new Set<string>();
  const days = definition['days'];

  if (Array.isArray(days)) {
    for (const day of days) {
      if (!isRecord(day) || !Array.isArray(day['slots'])) continue;
      for (const slot of day['slots']) {
        if (isRecord(slot) && typeof slot['exerciseId'] === 'string') {
          exerciseIds.add(slot['exerciseId']);
        }
      }
    }
  }

  const exercises = definition['exercises'];
  if (isRecord(exercises)) {
    for (const exerciseId of Object.keys(exercises)) exerciseIds.add(exerciseId);
  }

  return exerciseIds;
}

describe('catalog definition registry invariants', () => {
  it('has exactly one definition for every canonical catalog entry', () => {
    const catalogIds = PROGRAM_CATALOG.map(({ id }) => id);
    const registryIds = Object.keys(CATALOG_DEFINITION_JSONB_BY_ID);

    expect(new Set(catalogIds).size).toBe(catalogIds.length);
    expect(registryIds.toSorted()).toEqual(catalogIds.toSorted());
  });

  it('exposes a frozen read-only registry boundary', () => {
    expect(Object.isFrozen(CATALOG_DEFINITION_JSONB_BY_ID)).toBe(true);
  });

  it.each(PROGRAM_CATALOG)('$id hydrates into a schema-valid program definition', (metadata) => {
    const definition = CATALOG_DEFINITION_JSONB_BY_ID[metadata.id];
    if (!isRecord(definition)) {
      throw new Error(`Missing object definition for catalog program ${metadata.id}`);
    }

    const exercises = Object.fromEntries(
      [...collectExerciseIds(definition)].map((exerciseId) => [exerciseId, { name: exerciseId }])
    );
    const result = ProgramDefinitionSchema.safeParse({
      ...definition,
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      author: metadata.author,
      version: 1,
      category: metadata.category,
      source: 'preset',
      exercises,
    });

    if (!result.success) {
      throw new Error(
        `Invalid catalog definition ${metadata.id}: ${JSON.stringify(result.error.issues, null, 2)}`
      );
    }
    expect(result.data.id).toBe(metadata.id);
  });
});
