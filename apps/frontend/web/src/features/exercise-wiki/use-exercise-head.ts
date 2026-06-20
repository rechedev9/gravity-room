import { useEffect } from 'react';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { useHead } from '@/hooks/use-head';
import { articleUrl } from './exercise-json-ld';
import { appendHreflangAlternates } from './hreflang';

export function useExerciseHead(article: ExerciseArticle, lang: ArticleLang): void {
  const c = article.content[lang];
  const url = articleUrl(article, lang);
  useHead({
    title: `${c.title} — Gravity Room`,
    description: c.description,
    canonical: url,
    ogTitle: `${c.title} — Gravity Room`,
    ogDescription: c.description,
    ogUrl: url,
    ogLocale: lang === 'es' ? 'es_ES' : 'en_US',
    lang,
  });
  useEffect(() => {
    const esUrl = articleUrl(article, 'es');
    const enUrl = articleUrl(article, 'en');
    return appendHreflangAlternates([
      { hreflang: 'es', href: esUrl },
      { hreflang: 'en', href: enUrl },
      { hreflang: 'x-default', href: enUrl },
    ]);
  }, [article]);
}
