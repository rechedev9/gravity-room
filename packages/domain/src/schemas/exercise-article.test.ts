import { describe, expect, it } from 'bun:test';
import { ExerciseArticleSchema, ExerciseReferenceSchema } from './exercise-article';

const validRef = {
  doi: '10.1519/JSC.0000000000002255',
  title: 'A study',
  authors: 'Doe J, Roe R',
  year: 2018,
  url: 'https://doi.org/10.1519/JSC.0000000000002255',
};

const validArticle = {
  exerciseId: 'squat',
  slug: { es: 'sentadilla', en: 'squat' },
  muscleGroupId: 'legs',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['quadriceps', 'glutes'],
  secondaryMuscles: ['hamstrings'],
  references: [validRef],
  content: {
    es: {
      title: 'Sentadilla',
      description: 'Guía de la sentadilla.',
      summary: ['Resumen.'],
      technique: ['Paso 1.'],
      evidence: [{ claim: 'Activa el cuádriceps.', refIndices: [0] }],
      commonMistakes: ['Rodillas hacia dentro.'],
    },
    en: {
      title: 'Squat',
      description: 'Squat guide.',
      summary: ['Summary.'],
      technique: ['Step 1.'],
      evidence: [{ claim: 'Activates the quadriceps.', refIndices: [0] }],
      commonMistakes: ['Knees caving in.'],
    },
  },
  reviewedBy: 'Luis',
  reviewedAt: '2026-06-20',
};

describe('ExerciseReferenceSchema', () => {
  it('accepts a reference with a doi', () => {
    expect(ExerciseReferenceSchema.safeParse(validRef).success).toBe(true);
  });
  it('rejects a reference with neither doi nor pmid', () => {
    const { doi, ...noId } = validRef;
    expect(ExerciseReferenceSchema.safeParse(noId).success).toBe(false);
  });
});

describe('ExerciseArticleSchema', () => {
  it('accepts a complete bilingual article', () => {
    expect(ExerciseArticleSchema.safeParse(validArticle).success).toBe(true);
  });
  it('rejects an article missing references', () => {
    expect(ExerciseArticleSchema.safeParse({ ...validArticle, references: [] }).success).toBe(
      false
    );
  });
  it('rejects an article missing the en content', () => {
    const { en, ...esOnly } = validArticle.content;
    expect(ExerciseArticleSchema.safeParse({ ...validArticle, content: esOnly }).success).toBe(
      false
    );
  });
});
