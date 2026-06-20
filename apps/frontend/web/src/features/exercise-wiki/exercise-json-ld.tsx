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

  const breadcrumbPayload = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: lang === 'es' ? 'Ejercicios' : 'Exercises',
        item: lang === 'es' ? `${ORIGIN}/ejercicios` : `${ORIGIN}/en/exercises`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: c.title,
        item: url,
      },
    ],
  };
  const breadcrumbText = JSON.stringify(breadcrumbPayload).replace(/</g, '\\u003c');

  const videoText =
    article.video !== undefined
      ? JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: article.video.title,
          description: c.description,
          thumbnailUrl: `https://i.ytimg.com/vi/${article.video.youtubeId}/hqdefault.jpg`,
          uploadDate: article.video.uploadDate,
          duration: article.video.duration,
          embedUrl: `https://www.youtube-nocookie.com/embed/${article.video.youtubeId}`,
          contentUrl: `https://www.youtube.com/watch?v=${article.video.youtubeId}`,
        }).replace(/</g, '\\u003c')
      : null;

  return (
    <>
      <script type="application/ld+json">{jsonLdText}</script>
      <script type="application/ld+json">{breadcrumbText}</script>
      {videoText !== null && <script type="application/ld+json">{videoText}</script>}
    </>
  );
}
