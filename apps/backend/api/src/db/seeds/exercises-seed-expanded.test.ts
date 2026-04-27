/**
 * exercises-seed-expanded unit tests — verifies MUSCLE_GROUP_MAP coverage,
 * isExpandedExerciseRaw type guard, and fail-fast error throwing in seedExercisesExpanded.
 *
 * MUSCLE_GROUP_MAP and isExpandedExerciseRaw are exported for testability.
 * seedExercisesExpanded is tested via a JSON module mock (registered before first import).
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock } from 'bun:test';
import { MUSCLE_GROUP_MAP, isExpandedExerciseRaw } from './exercises-seed-expanded';

// ---------------------------------------------------------------------------
// Minimal DB mock — accepts insert().values().onConflictDoNothing() chain
// ---------------------------------------------------------------------------

function createMockDb(): unknown {
  return {
    insert: mock(() => ({
      values: mock(() => ({
        onConflictDoNothing: mock(() => Promise.resolve([])),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

function validEntry(id: string, primaryMuscle: string) {
  return {
    id,
    nameEs: `Test ${id}`,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles: [primaryMuscle],
    secondaryMuscles: [],
    category: 'strength',
  };
}

// ---------------------------------------------------------------------------
// Task 4.1 — MUSCLE_GROUP_MAP covers all 17 source names (REQ-SEED-002)
// ---------------------------------------------------------------------------

/** All 17 source muscle names that must be in MUSCLE_GROUP_MAP. */
const EXPECTED_MUSCLE_NAMES = [
  'abdominals',
  'adductors',
  'abductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
] as const;

describe('MUSCLE_GROUP_MAP', () => {
  it('contains exactly 17 source muscle name entries', () => {
    expect(Object.keys(MUSCLE_GROUP_MAP)).toHaveLength(17);
  });

  it.each(EXPECTED_MUSCLE_NAMES.map((m) => [m]))(
    'maps source name "%s" to a non-empty target ID',
    (name) => {
      const target = MUSCLE_GROUP_MAP[name as string];
      expect(typeof target).toBe('string');
      expect((target ?? '').length).toBeGreaterThan(0);
    }
  );

  it('does not map unknown muscle names', () => {
    expect(MUSCLE_GROUP_MAP['unknown_group']).toBeUndefined();
    expect(MUSCLE_GROUP_MAP['deltoids']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Task 4.1 — isExpandedExerciseRaw type guard (REQ-SEED-003)
// ---------------------------------------------------------------------------

describe('isExpandedExerciseRaw', () => {
  it('accepts a fully valid exercise entry', () => {
    const valid = validEntry('squat', 'quadriceps');
    expect(isExpandedExerciseRaw(valid)).toBe(true);
  });

  it('rejects null', () => {
    expect(isExpandedExerciseRaw(null)).toBe(false);
  });

  it('rejects entry missing nameEs', () => {
    const bad = {
      id: 'x',
      level: 'beginner',
      category: 'strength',
      primaryMuscles: [],
      secondaryMuscles: [],
    };
    expect(isExpandedExerciseRaw(bad)).toBe(false);
  });

  it('rejects entry missing id', () => {
    const bad = {
      nameEs: 'X',
      level: 'beginner',
      category: 'strength',
      primaryMuscles: [],
      secondaryMuscles: [],
    };
    expect(isExpandedExerciseRaw(bad)).toBe(false);
  });

  it('rejects entry missing primaryMuscles (not an array)', () => {
    const bad = {
      id: 'x',
      nameEs: 'X',
      level: 'beginner',
      category: 'strength',
      secondaryMuscles: [],
    };
    expect(isExpandedExerciseRaw(bad)).toBe(false);
  });

  it('rejects entry where level is not a string', () => {
    const bad = {
      id: 'x',
      nameEs: 'X',
      level: 42,
      category: 'strength',
      primaryMuscles: [],
      secondaryMuscles: [],
    };
    expect(isExpandedExerciseRaw(bad)).toBe(false);
  });

  it('accepts entry with null optional fields (force, mechanic, equipment)', () => {
    const withNulls = {
      id: 'bench',
      nameEs: 'Press',
      force: null,
      level: 'intermediate',
      mechanic: null,
      equipment: null,
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps'],
      category: 'strength',
    };
    expect(isExpandedExerciseRaw(withNulls)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 4.4 — seedExercisesExpanded fail-fast on unmapped muscle (REQ-SEED-002)
// ---------------------------------------------------------------------------

describe('seedExercisesExpanded — fail-fast on unmapped primaryMuscles[0]', () => {
  it('throws with exercise ID when primaryMuscles[0] is not in MUSCLE_GROUP_MAP', async () => {
    // Arrange — use a mock JSON with one bad entry injected via mock.module
    const badData = [validEntry('bad_muscle_ex', 'unknown_group')];
    mock.module('./data/exercises-expanded.json', () => ({ default: badData }));

    const { seedExercisesExpanded } = await import('./exercises-seed-expanded');
    const db = createMockDb();

    // Act / Assert
    await expect(
      seedExercisesExpanded(db as Parameters<typeof seedExercisesExpanded>[0])
    ).rejects.toThrow('bad_muscle_ex');
  });

  it('throws with the unmapped muscle name in the error message', async () => {
    const badData = [validEntry('mystery_ex', 'mystery_muscle')];
    mock.module('./data/exercises-expanded.json', () => ({ default: badData }));

    const { seedExercisesExpanded } = await import('./exercises-seed-expanded');
    const db = createMockDb();

    const err = await seedExercisesExpanded(
      db as Parameters<typeof seedExercisesExpanded>[0]
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('mystery_muscle');
  });
});
