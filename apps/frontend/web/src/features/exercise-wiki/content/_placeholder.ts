import type { ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

export const placeholderArticle: ExerciseArticle = {
  exerciseId: 'squat',
  slug: { es: 'sentadilla', en: 'squat' },
  muscleGroupId: 'legs',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['quadriceps', 'glutes'],
  secondaryMuscles: ['hamstrings', 'erector spinae'],
  references: [
    {
      doi: '10.1519/JSC.0000000000002255',
      title: 'Placeholder reference — replace before publish',
      authors: 'TBD',
      year: 2018,
      url: 'https://doi.org/10.1519/JSC.0000000000002255',
    },
  ],
  content: {
    es: {
      title: 'Sentadilla',
      description: 'Placeholder.',
      summary: ['Placeholder.'],
      technique: ['Placeholder.'],
      evidence: [{ claim: 'Placeholder.', refIndices: [0] }],
      commonMistakes: ['Placeholder.'],
    },
    en: {
      title: 'Squat',
      description: 'Placeholder.',
      summary: ['Placeholder.'],
      technique: ['Placeholder.'],
      evidence: [{ claim: 'Placeholder.', refIndices: [0] }],
      commonMistakes: ['Placeholder.'],
    },
  },
  reviewedBy: 'PLACEHOLDER',
  reviewedAt: '2026-06-20',
};
