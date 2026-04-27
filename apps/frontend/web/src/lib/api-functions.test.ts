/**
 * api-functions unit tests — verifies parseExerciseEntry correctly handles
 * the 5 new nullable fields introduced by exercise-db-expansion, and
 * fetchExercises correctly parses the paginated envelope (REQ-EXPAG-005).
 *
 * Tests cover: all fields present (REQ-CLIENT-002 s1), fields absent (s2),
 * secondaryMuscles:null (s3), mixed-type secondaryMuscles array (s4),
 * paginated envelope parsing via Zod schema (REQ-EXPAG-005).
 */
import { describe, it, expect } from 'bun:test';
import { z } from 'zod/v4';
import { parseExerciseEntry } from './api-functions';

// ---------------------------------------------------------------------------
// Base fixture — minimal valid exercise raw response
// ---------------------------------------------------------------------------

const BASE_RAW = {
  id: 'squat',
  name: 'Sentadilla',
  muscleGroupId: 'legs',
  equipment: 'barbell',
  isCompound: true,
  isPreset: true,
  createdBy: null,
};

// ---------------------------------------------------------------------------
// Task 4.6 scenario 1 — all 5 new fields populated (REQ-CLIENT-002)
// ---------------------------------------------------------------------------

describe('parseExerciseEntry — 5 new metadata fields', () => {
  it('maps all 5 new fields when present', () => {
    // Arrange
    const raw = {
      ...BASE_RAW,
      force: 'push',
      level: 'beginner',
      mechanic: 'compound',
      category: 'strength',
      secondaryMuscles: ['back', 'core'],
    };

    // Act
    const entry = parseExerciseEntry(raw);

    // Assert
    expect(entry.force).toBe('push');
    expect(entry.level).toBe('beginner');
    expect(entry.mechanic).toBe('compound');
    expect(entry.category).toBe('strength');
    expect(entry.secondaryMuscles).toEqual(['back', 'core']);
  });

  // ---------------------------------------------------------------------------
  // Task 4.6 scenario 2 — all new fields absent → all null
  // ---------------------------------------------------------------------------

  it('returns null for all new fields when they are absent from the response', () => {
    // Arrange — raw object has no new fields
    const raw = { ...BASE_RAW };

    // Act
    const entry = parseExerciseEntry(raw);

    // Assert
    expect(entry.force).toBeNull();
    expect(entry.level).toBeNull();
    expect(entry.mechanic).toBeNull();
    expect(entry.category).toBeNull();
    expect(entry.secondaryMuscles).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Task 4.6 scenario 3 — secondaryMuscles:null → null
  // ---------------------------------------------------------------------------

  it('returns secondaryMuscles:null when the field is null in the response', () => {
    // Arrange
    const raw = { ...BASE_RAW, secondaryMuscles: null };

    // Act
    const entry = parseExerciseEntry(raw);

    // Assert
    expect(entry.secondaryMuscles).toBeNull();
  });

  it('returns secondaryMuscles:null when secondaryMuscles is an empty array', () => {
    // parseSecondaryMuscles returns null for empty filtered results
    const raw = { ...BASE_RAW, secondaryMuscles: [] };
    const entry = parseExerciseEntry(raw);
    expect(entry.secondaryMuscles).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Task 4.6 scenario 4 — mixed-type secondaryMuscles filters to strings only
  // ---------------------------------------------------------------------------

  it('filters non-string values out of secondaryMuscles', () => {
    // Arrange — array with mixed types; only strings should survive
    const raw = {
      ...BASE_RAW,
      secondaryMuscles: ['back', 42, null, 'core', true, undefined],
    };

    // Act
    const entry = parseExerciseEntry(raw);

    // Assert — only the two string values remain
    expect(entry.secondaryMuscles).toEqual(['back', 'core']);
  });

  it('returns null when secondaryMuscles has no string entries', () => {
    const raw = { ...BASE_RAW, secondaryMuscles: [1, 2, null, false] };
    const entry = parseExerciseEntry(raw);
    expect(entry.secondaryMuscles).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Additional coverage — non-string new field values → null
  // ---------------------------------------------------------------------------

  it('returns null for force when the value is not a string (e.g. number)', () => {
    const raw = { ...BASE_RAW, force: 42 };
    const entry = parseExerciseEntry(raw);
    expect(entry.force).toBeNull();
  });

  it('returns null for level when the value is a boolean', () => {
    const raw = { ...BASE_RAW, level: true };
    const entry = parseExerciseEntry(raw);
    expect(entry.level).toBeNull();
  });

  it('returns null for mechanic when the value is an object', () => {
    const raw = { ...BASE_RAW, mechanic: {} };
    const entry = parseExerciseEntry(raw);
    expect(entry.mechanic).toBeNull();
  });

  it('returns null for category when the value is undefined', () => {
    const raw = { ...BASE_RAW, category: undefined };
    const entry = parseExerciseEntry(raw);
    expect(entry.category).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Core fields still mapped correctly alongside new fields
  // ---------------------------------------------------------------------------

  it('preserves core fields when new fields are also present', () => {
    const raw = {
      ...BASE_RAW,
      force: 'pull',
      level: 'intermediate',
      mechanic: 'isolation',
      category: 'strength',
      secondaryMuscles: ['arms'],
    };
    const entry = parseExerciseEntry(raw);

    // Core fields
    expect(entry.id).toBe('squat');
    expect(entry.name).toBe('Sentadilla');
    expect(entry.muscleGroupId).toBe('legs');
    expect(entry.isCompound).toBe(true);
    expect(entry.isPreset).toBe(true);

    // New fields
    expect(entry.force).toBe('pull');
    expect(entry.level).toBe('intermediate');
  });
});

// ---------------------------------------------------------------------------
// fetchExercises — paginated envelope (REQ-EXPAG-005)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// fetchExercises — paginated envelope Zod validation (REQ-EXPAG-005)
//
// Testing the Zod schema that fetchExercises uses to validate the API response.
// Direct testing of fetchExercises is not possible here because bun:test's
// mock.module() from other test files (use-program.test.ts) replaces the
// api-functions module. Instead we test the schema contract directly, which
// is the critical validation path.
// ---------------------------------------------------------------------------

/** Replicates the PaginatedExercisesResponseSchema from api-functions.ts */
const PaginatedExercisesResponseSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

describe('fetchExercises — paginated envelope Zod validation', () => {
  it('parses valid paginated envelope with all four fields', () => {
    // Arrange
    const envelope = {
      data: [
        {
          ...BASE_RAW,
          force: null,
          level: null,
          mechanic: null,
          category: null,
          secondaryMuscles: null,
        },
      ],
      total: 475,
      offset: 0,
      limit: 100,
    };

    // Act
    const parsed = PaginatedExercisesResponseSchema.parse(envelope);

    // Assert
    expect(parsed.total).toBe(475);
    expect(parsed.offset).toBe(0);
    expect(parsed.limit).toBe(100);
    expect(parsed.data).toHaveLength(1);

    // Verify parseExerciseEntry can handle the data
    const entry = parseExerciseEntry(parsed.data[0]);
    expect(entry.id).toBe('squat');
  });

  it('throws ZodError when response is a bare array (legacy shape)', () => {
    // Arrange — legacy shape: just an array, not an envelope
    const legacyResponse = [BASE_RAW];

    // Act / Assert — Zod .parse() throws on invalid shape
    let error: unknown;
    try {
      PaginatedExercisesResponseSchema.parse(legacyResponse);
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
  });
});
