import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { placeholderArticle } from './_placeholder';

export const EXERCISE_ARTICLES: readonly ExerciseArticle[] = [placeholderArticle];

export function getAllArticles(): readonly ExerciseArticle[] {
  return EXERCISE_ARTICLES;
}

export function getArticleBySlug(lang: ArticleLang, slug: string): ExerciseArticle | undefined {
  return EXERCISE_ARTICLES.find((a) => a.slug[lang] === slug);
}
