import type { ReactNode } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { getArticleBySlug } from './content/registry';
import { ArticleNotFound } from './article-not-found';
import { ExerciseArticleView } from './exercise-article-view';
import { ExerciseJsonLd } from './exercise-json-ld';
import { useExerciseHead } from './use-exercise-head';

/** In-app path base for the exercise wiki rendered inside the app shell. */
const APP_WIKI_BASE = '/app/exercises';

function ArticleContent({
  article,
  lang,
}: {
  readonly article: ExerciseArticle;
  readonly lang: ArticleLang;
}): ReactNode {
  useExerciseHead(article, lang);
  return (
    <>
      <ExerciseJsonLd article={article} lang={lang} />
      <ExerciseArticleView article={article} lang={lang} />
    </>
  );
}

interface ExerciseArticlePageProps {
  readonly lang: ArticleLang;
  /** When true the article renders inside the app shell (route `/app/exercises/$slug`). */
  readonly inApp?: boolean;
}

export function ExerciseArticlePage({ lang, inApp = false }: ExerciseArticlePageProps): ReactNode {
  // The in-app route is nested under the pathless `app-layout` parent, so its
  // route id carries that prefix even though its navigable path is /app/exercises.
  const from = inApp
    ? '/app-layout/app/exercises/$slug'
    : lang === 'es'
      ? '/ejercicios/$slug'
      : '/en/exercises/$slug';
  const { slug } = useParams({ from });
  const article = getArticleBySlug(lang, slug);

  if (article === undefined) {
    return <ArticleNotFound lang={lang} backTo={inApp ? APP_WIKI_BASE : undefined} />;
  }

  return <ArticleContent article={article} lang={lang} />;
}

/**
 * In-app exercise article (route `/app/exercises/$slug`). Resolves the article
 * language from the active UI locale and renders the shared article view inside
 * the authenticated app shell.
 */
export function AppExerciseArticlePage(): ReactNode {
  const { i18n } = useTranslation();
  const lang: ArticleLang = i18n.language.startsWith('en') ? 'en' : 'es';
  return <ExerciseArticlePage lang={lang} inApp />;
}
