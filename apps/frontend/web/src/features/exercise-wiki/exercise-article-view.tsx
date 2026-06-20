// exercise-article-view.tsx
import type { ReactNode } from 'react';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';

const LABELS = {
  es: {
    summary: 'Resumen',
    technique: 'Técnica',
    evidence: 'Evidencia',
    mistakes: 'Errores comunes',
    variations: 'Variantes y progresiones',
    references: 'Referencias',
    videoGuide: 'Guía en vídeo',
  },
  en: {
    summary: 'Summary',
    technique: 'Technique',
    evidence: 'Evidence',
    mistakes: 'Common mistakes',
    variations: 'Variations & progressions',
    references: 'References',
    videoGuide: 'Video guide',
  },
} as const;

export function ExerciseArticleView({
  article,
  lang,
}: {
  readonly article: ExerciseArticle;
  readonly lang: ArticleLang;
}): ReactNode {
  const c = article.content[lang];
  const l = LABELS[lang];
  return (
    <article className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-title">{c.title}</h1>
        <p className="text-muted">{c.description}</p>
      </header>

      {article.video !== undefined && (
        <section className="space-y-2">
          <h2 className="font-display text-2xl text-main">{l.videoGuide}</h2>
          <div className="aspect-video w-full overflow-hidden rounded-sm border border-rule">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${article.video.youtubeId}`}
              title={article.video.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.summary}</h2>
        {c.summary.map((p, i) => (
          <p key={i} className="text-main">
            {p}
          </p>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.technique}</h2>
        <ol className="list-decimal pl-5 space-y-1 text-main">
          {c.technique.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.evidence}</h2>
        <ul className="space-y-1 text-main">
          {c.evidence.map((e, i) => (
            <li key={i}>
              {e.claim}{' '}
              {e.refIndices.map((r) => (
                <sup key={r}>
                  <a href={`#ref-${r}`} className="text-accent">
                    [{r + 1}]
                  </a>
                </sup>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.mistakes}</h2>
        <ul className="list-disc pl-5 space-y-1 text-main">
          {c.commonMistakes.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </section>

      {c.variations !== undefined && c.variations.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-2xl text-main">{l.variations}</h2>
          <ul className="space-y-1 text-main">
            {c.variations.map((v, i) => (
              <li key={i}>
                <span className="font-semibold text-title">{v.name}</span> — {v.detail}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-display text-2xl text-main">{l.references}</h2>
        <ol
          data-testid="exercise-references"
          className="list-decimal pl-5 space-y-1 text-sm text-muted"
        >
          {article.references.map((r, i) => (
            <li key={i} id={`ref-${i}`}>
              {r.authors} ({r.year}).{' '}
              <a href={r.url} target="_blank" rel="noreferrer" className="text-accent">
                {r.title}
              </a>
              {r.doi !== undefined
                ? ` doi:${r.doi}`
                : r.pmid !== undefined
                  ? ` PMID:${r.pmid}`
                  : ''}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
