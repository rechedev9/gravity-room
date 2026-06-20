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
