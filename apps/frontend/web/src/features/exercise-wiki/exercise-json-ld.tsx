import type { ReactNode } from 'react';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

const ORIGIN = 'https://gravityroom.app';

export function articleUrl(article: ExerciseArticle, lang: ArticleLang): string {
  return lang === 'es'
    ? `${ORIGIN}/ejercicios/${article.slug.es}`
    : `${ORIGIN}/en/exercises/${article.slug.en}`;
}

export function ExerciseJsonLd({
  article,
  lang,
}: {
  readonly article: ExerciseArticle;
  readonly lang: ArticleLang;
}): ReactNode {
  const c = article.content[lang];
  const url = articleUrl(article, lang);
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: c.title,
    description: c.description,
    url,
    inLanguage: lang,
    citation: article.references.map((r) => ({
      '@type': 'CreativeWork',
      name: r.title,
      author: r.authors,
      datePublished: String(r.year),
      url: r.url,
      ...(r.doi !== undefined ? { sameAs: `https://doi.org/${r.doi}` } : {}),
    })),
    isPartOf: {
      '@type': 'WebSite',
      name: 'Gravity Room',
      url: ORIGIN,
    },
  };
  const jsonLdText = JSON.stringify(payload).replace(/</g, '\\u003c');
  return <script type="application/ld+json">{jsonLdText}</script>;
}
