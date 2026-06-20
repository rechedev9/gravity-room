import type { ReactNode } from 'react';
import { useParams } from '@tanstack/react-router';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { getArticleBySlug } from './content/registry';
import { ArticleNotFound } from './article-not-found';
import { ExerciseArticleView } from './exercise-article-view';
import { ExerciseJsonLd } from './exercise-json-ld';
import { useExerciseHead } from './use-exercise-head';

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

export function ExerciseArticlePage({ lang }: { readonly lang: ArticleLang }): ReactNode {
  const from = lang === 'es' ? '/ejercicios/$slug' : '/en/exercises/$slug';
  const { slug } = useParams({ from });
  const article = getArticleBySlug(lang, slug);

  if (article === undefined) {
    return <ArticleNotFound lang={lang} />;
  }

  return <ArticleContent article={article} lang={lang} />;
}
