import type { ReactNode } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { getArticleBySlug } from './content/registry';
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
    const backTo = lang === 'es' ? '/ejercicios' : '/en/exercises';
    return (
      <div className="text-center py-16 px-4">
        <p className="text-muted mb-6 text-sm">
          {lang === 'es' ? 'Ejercicio no encontrado.' : 'Exercise not found.'}
        </p>
        <Link to={backTo} className="text-accent text-sm">
          {lang === 'es' ? 'Volver' : 'Back'}
        </Link>
      </div>
    );
  }

  return <ArticleContent article={article} lang={lang} />;
}
