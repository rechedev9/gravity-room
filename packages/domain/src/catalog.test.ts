import { describe, expect, it } from 'vitest';

import { PROGRAM_CATALOG, PROGRAM_LEVELS } from './catalog';

// The catalog holds program *metadata* only — the full JSONB ProgramDefinition
// payloads live in packages/database/src/seeds/ — so there is no definition
// schema to parse entries against here. These tests pin the metadata invariants
// the API seed and other consumers rely on.

const ALLOWED_CATEGORIES = ['strength', 'hypertrophy', 'powerlifting'] as const;

describe('PROGRAM_CATALOG', () => {
  it('is non-empty', () => {
    expect(PROGRAM_CATALOG.length).toBeGreaterThan(0);
  });

  it('has a unique id for every entry', () => {
    const ids = PROGRAM_CATALOG.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses lowercase-kebab ids (stable slugs used as DB primary keys)', () => {
    for (const program of PROGRAM_CATALOG) {
      expect(program.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('only uses known level values', () => {
    const allowedLevels: readonly string[] = PROGRAM_LEVELS;

    for (const program of PROGRAM_CATALOG) {
      expect(allowedLevels).toContain(program.level);
    }
  });

  it('only uses known category values', () => {
    const allowedCategories: readonly string[] = ALLOWED_CATEGORIES;

    for (const program of PROGRAM_CATALOG) {
      expect(allowedCategories).toContain(program.category);
    }
  });

  it('has non-empty name, description, and author on every entry', () => {
    for (const program of PROGRAM_CATALOG) {
      expect(program.name.trim().length).toBeGreaterThan(0);
      expect(program.description.trim().length).toBeGreaterThan(0);
      expect(program.author.trim().length).toBeGreaterThan(0);
    }
  });

  it('has at least one active program', () => {
    expect(PROGRAM_CATALOG.some((p) => p.isActive)).toBe(true);
  });
});
