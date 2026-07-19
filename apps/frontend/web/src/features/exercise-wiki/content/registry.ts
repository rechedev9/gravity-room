import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { squatArticle } from './squat';
import { benchArticle } from './bench';
import { deadliftArticle } from './deadlift';

export const EXERCISE_ARTICLES: readonly ExerciseArticle[] = [
  squatArticle,
  benchArticle,
  deadliftArticle,
];

export function getAllArticles(): readonly ExerciseArticle[] {
  return EXERCISE_ARTICLES;
}

export function getArticleBySlug(lang: ArticleLang, slug: string): ExerciseArticle | undefined {
  return EXERCISE_ARTICLES.find((a) => a.slug[lang] === slug);
}

/**
 * Look up a curated guide by the catalog exercise id it documents. Used by the
 * exercise catalog browser to link a catalog row to its in-app guide when one
 * exists (the three guides map to catalog ids `squat`, `bench`, `deadlift`).
 */
export function getArticleByExerciseId(exerciseId: string): ExerciseArticle | undefined {
  return EXERCISE_ARTICLES.find((a) => a.exerciseId === exerciseId);
}
