/**
 * definition-utils.ts unit tests — collectExerciseIds over definition JSONB.
 *
 * The function must gather ids from both the `exercises` map keys and
 * `days[].slots[].exerciseId`, and never throw on malformed input (the
 * definition column is untrusted JSONB).
 */
import { describe, it, expect } from 'vitest';
import { collectExerciseIds } from './definition-utils';

describe('collectExerciseIds', () => {
  it('collects ids from exercises map keys and days[].slots[].exerciseId', () => {
    // Arrange
    const definition = {
      exercises: { squat: { name: 'Squat' }, bench: { name: 'Bench' } },
      days: [
        { slots: [{ exerciseId: 'squat' }, { exerciseId: 'row' }] },
        { slots: [{ exerciseId: 'ohp' }] },
      ],
    };

    // Act
    const ids = collectExerciseIds(definition);

    // Assert — union of both sources
    expect(ids).toEqual(new Set(['squat', 'bench', 'row', 'ohp']));
  });

  it('de-duplicates ids referenced in both sources', () => {
    // Arrange
    const definition = {
      exercises: { squat: {} },
      days: [{ slots: [{ exerciseId: 'squat' }, { exerciseId: 'squat' }] }],
    };

    // Act
    const ids = collectExerciseIds(definition);

    // Assert
    expect(ids).toEqual(new Set(['squat']));
    expect(ids.size).toBe(1);
  });

  it('returns an empty set for non-record input', () => {
    expect(collectExerciseIds(null)).toEqual(new Set());
    expect(collectExerciseIds(undefined)).toEqual(new Set());
    expect(collectExerciseIds('squat')).toEqual(new Set());
    expect(collectExerciseIds(42)).toEqual(new Set());
    expect(collectExerciseIds([{ exerciseId: 'squat' }])).toEqual(new Set());
  });

  it('returns an empty set for an empty record', () => {
    expect(collectExerciseIds({})).toEqual(new Set());
  });

  it('ignores a non-record exercises field but still walks days', () => {
    // Arrange — exercises is malformed (array), days is valid
    const definition = {
      exercises: ['squat', 'bench'],
      days: [{ slots: [{ exerciseId: 'row' }] }],
    };

    // Act / Assert — array keys must NOT leak in as ids
    expect(collectExerciseIds(definition)).toEqual(new Set(['row']));
  });

  it('returns only exercises keys when days is not an array', () => {
    // Arrange
    const definition = {
      exercises: { squat: {} },
      days: { 0: { slots: [{ exerciseId: 'row' }] } },
    };

    // Act / Assert
    expect(collectExerciseIds(definition)).toEqual(new Set(['squat']));
  });

  it('skips malformed days and slots entries without throwing', () => {
    // Arrange — every kind of malformed entry alongside one valid slot
    const definition = {
      days: [
        null,
        'not a day',
        ['array day'],
        { slots: 'not an array' },
        { slots: null },
        {}, // no slots at all
        { slots: [null, 'not a slot', 42, {}, { exerciseId: 123 }, { exerciseId: 'valid-id' }] },
      ],
    };

    // Act
    const ids = collectExerciseIds(definition);

    // Assert — only the well-formed string exerciseId survives
    expect(ids).toEqual(new Set(['valid-id']));
  });

  it('ignores non-string exerciseId values', () => {
    // Arrange
    const definition = {
      days: [
        {
          slots: [
            { exerciseId: 0 },
            { exerciseId: false },
            { exerciseId: null },
            { exerciseId: { id: 'nested' } },
          ],
        },
      ],
    };

    // Act / Assert
    expect(collectExerciseIds(definition)).toEqual(new Set());
  });
});
