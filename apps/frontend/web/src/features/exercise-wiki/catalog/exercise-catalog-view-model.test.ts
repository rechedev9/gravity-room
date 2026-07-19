import { describe, expect, it } from 'vitest';
import type { ExerciseEntry } from '@/lib/api-functions';
import {
  attributeSlug,
  computePageInfo,
  guideSlugForExercise,
  uniqueSecondaryMuscles,
  CATALOG_PAGE_SIZE,
} from './exercise-catalog-view-model';

function makeExercise(overrides: Partial<ExerciseEntry>): ExerciseEntry {
  return {
    id: 'x',
    name: 'X',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
    isPreset: true,
    createdBy: null,
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    category: 'strength',
    secondaryMuscles: null,
    ...overrides,
  };
}

describe('attributeSlug', () => {
  it('lowercases and underscores multi-word values', () => {
    expect(attributeSlug('body only')).toBe('body_only');
    expect(attributeSlug('olympic weightlifting')).toBe('olympic_weightlifting');
  });

  it('collapses punctuation runs and trims edges', () => {
    expect(attributeSlug('e-z curl bar')).toBe('e_z_curl_bar');
    expect(attributeSlug('  Push  ')).toBe('push');
  });
});

describe('guideSlugForExercise', () => {
  it('returns the localized guide slug for a documented catalog id', () => {
    expect(guideSlugForExercise(makeExercise({ id: 'squat' }), 'es')).toBe('sentadilla');
    expect(guideSlugForExercise(makeExercise({ id: 'squat' }), 'en')).toBe('squat');
    expect(guideSlugForExercise(makeExercise({ id: 'bench' }), 'en')).toBe('bench-press');
    expect(guideSlugForExercise(makeExercise({ id: 'deadlift' }), 'es')).toBe('peso-muerto');
  });

  it('returns undefined for exercises without a guide', () => {
    expect(guideSlugForExercise(makeExercise({ id: 'hack_squat' }), 'es')).toBeUndefined();
  });
});

describe('uniqueSecondaryMuscles', () => {
  it('dedupes while preserving first-seen order', () => {
    const ex = makeExercise({
      secondaryMuscles: ['calves', 'legs', 'legs', 'shoulders', 'calves'],
    });
    expect(uniqueSecondaryMuscles(ex)).toEqual(['calves', 'legs', 'shoulders']);
  });

  it('returns an empty list when there are no secondary muscles', () => {
    expect(uniqueSecondaryMuscles(makeExercise({ secondaryMuscles: null }))).toEqual([]);
  });
});

describe('computePageInfo', () => {
  it('reports an empty state when there are no results', () => {
    expect(computePageInfo(0, 0, CATALOG_PAGE_SIZE)).toEqual({
      from: 0,
      to: 0,
      total: 0,
      page: 1,
      pageCount: 0,
      hasPrev: false,
      hasNext: false,
    });
  });

  it('describes the first page of a multi-page set', () => {
    const info = computePageInfo(811, 0, 20);
    expect(info).toMatchObject({
      from: 1,
      to: 20,
      page: 1,
      pageCount: 41,
      hasPrev: false,
      hasNext: true,
    });
  });

  it('describes a middle page', () => {
    const info = computePageInfo(811, 40, 20);
    expect(info).toMatchObject({ from: 41, to: 60, page: 3, hasPrev: true, hasNext: true });
  });

  it('clamps the last (partial) page to the total', () => {
    const info = computePageInfo(811, 800, 20);
    expect(info).toMatchObject({ from: 801, to: 811, page: 41, hasPrev: true, hasNext: false });
  });
});
