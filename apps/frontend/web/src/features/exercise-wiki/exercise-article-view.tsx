// exercise-article-view.tsx
import type { CSSProperties, ReactNode } from 'react';
import type { ArticleLang, ExerciseArticle } from '@gzclp/domain/schemas/exercise-article';
import { BodyDiagram } from './body-diagram';

const LABELS = {
  es: {
    summary: 'Resumen',
    muscles: 'Músculos implicados',
    technique: 'Técnica',
    evidence: 'Evidencia',
    mistakes: 'Errores comunes',
    variations: 'Variantes y progresiones',
    references: 'Referencias',
    videoGuide: 'Guía en vídeo',
  },
  en: {
    summary: 'Summary',
    muscles: 'Muscles worked',
    technique: 'Technique',
    evidence: 'Evidence',
    mistakes: 'Common mistakes',
    variations: 'Variations & progressions',
    references: 'References',
    videoGuide: 'Video guide',
  },
} as const;

// Justified body prose with hyphenation — the academic-paper measure the
// content is written for. Last line stays left so a short tail doesn't stretch.
const PROSE: CSSProperties = {
  textAlign: 'justify',
  textAlignLast: 'left',
  hyphens: 'auto',
  WebkitHyphens: 'auto',
};

// Content strings carry minimal `**bold**` emphasis markers (see the technique
// steps in the content files); render them as <strong> instead of leaking the
// asterisks to the reader. Unbalanced markers fall back to the raw string.
function renderEmphasis(text: string): ReactNode {
  const parts = text.split('**');
  if (parts.length < 3 || parts.length % 2 === 0) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-title">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

function SectionHeader({
  index,
  label,
}: {
  readonly index: string;
  readonly label: string;
}): ReactNode {
  return (
    <div className="mb-5 flex items-baseline gap-3 border-b border-rule pb-2.5">
      <span className="font-mono text-xs tracking-[0.2em] text-accent select-none">{index}</span>
      <span className="font-mono text-xs tracking-[0.2em] text-label select-none">—</span>
      <h2 className="font-display text-2xl uppercase text-title">{label}</h2>
    </div>
  );
}

export function ExerciseArticleView({
  article,
  lang,
}: {
  readonly article: ExerciseArticle;
  readonly lang: ArticleLang;
}): ReactNode {
  const c = article.content[lang];
  const l = LABELS[lang];
  const hasVariations = c.variations !== undefined && c.variations.length > 0;

  // Gapless 01/02 section numbering, computed in render order so optional
  // sections (video, variations) don't leave holes.
  let n = 0;
  const nextNum = (): string => {
    n += 1;
    return String(n).padStart(2, '0');
  };
  const videoNum = article.video !== undefined ? nextNum() : null;
  const summaryNum = nextNum();
  const musclesNum = nextNum();
  const techniqueNum = nextNum();
  const evidenceNum = nextNum();
  const mistakesNum = nextNum();
  const variationsNum = hasVariations ? nextNum() : null;
  const referencesNum = nextNum();

  // Staggered entrance delays, in the same render order as the numbering.
  let d = 0;
  const nextDelay = (): string => {
    const value = `${(d * 0.06).toFixed(2)}s`;
    d += 1;
    return value;
  };
  const headerDelay = nextDelay();
  const videoDelay = article.video !== undefined ? nextDelay() : null;
  const summaryDelay = nextDelay();
  const musclesDelay = nextDelay();
  const techniqueDelay = nextDelay();
  const evidenceDelay = nextDelay();
  const mistakesDelay = nextDelay();
  const variationsDelay = hasVariations ? nextDelay() : null;
  const referencesDelay = nextDelay();

  return (
    <article lang={lang} className="mx-auto max-w-[65ch] px-4 sm:px-6 py-12 text-main">
      <header className="anim-rise mb-12" style={{ animationDelay: headerDelay }}>
        <h1 className="font-display text-5xl uppercase leading-none text-title">{c.title}</h1>
        {/* The single scarce gold signal on the page — drawn in on load. */}
        <div className="anim-rule mt-4 mb-5 h-px w-16 bg-accent" />
        <p className="text-base leading-relaxed text-muted" style={PROSE}>
          {c.description}
        </p>
      </header>

      {article.video !== undefined && videoNum !== null && (
        <section
          className="anim-rise mb-12"
          style={{ animationDelay: videoDelay ?? undefined }}
          aria-label={l.videoGuide}
        >
          <SectionHeader index={videoNum} label={l.videoGuide} />
          <div className="aspect-video w-full overflow-hidden rounded-sm border border-rule bg-ink transition-colors hover:border-rule-light">
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

      <section
        className="anim-rise mb-12"
        style={{ animationDelay: summaryDelay }}
        aria-label={l.summary}
      >
        <SectionHeader index={summaryNum} label={l.summary} />
        <div className="space-y-4">
          {c.summary.map((p, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'text-[1.0625rem] leading-relaxed text-title'
                  : 'text-base leading-relaxed text-main'
              }
              style={PROSE}
            >
              {renderEmphasis(p)}
            </p>
          ))}
        </div>
      </section>

      <section
        className="anim-rise mb-12"
        style={{ animationDelay: musclesDelay }}
        aria-label={l.muscles}
      >
        <SectionHeader index={musclesNum} label={l.muscles} />
        <BodyDiagram
          primary={article.primaryMuscles}
          secondary={article.secondaryMuscles}
          lang={lang}
          view="both"
          showLegend
        />
      </section>

      <section
        className="anim-rise mb-12"
        style={{ animationDelay: techniqueDelay }}
        aria-label={l.technique}
      >
        <SectionHeader index={techniqueNum} label={l.technique} />
        {/* Short imperative steps read better left-aligned, not justified. */}
        <ol className="space-y-3">
          {c.technique.map((p, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="mt-0.5 w-5 shrink-0 font-mono text-xs text-accent select-none">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-base leading-relaxed text-main">{renderEmphasis(p)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="anim-rise mb-12"
        style={{ animationDelay: evidenceDelay }}
        aria-label={l.evidence}
      >
        <SectionHeader index={evidenceNum} label={l.evidence} />
        <ul className="space-y-3">
          {c.evidence.map((e, i) => (
            <li
              key={i}
              className="rounded-sm border border-rule bg-card px-5 py-4 text-base leading-relaxed text-main transition-colors hover:border-rule-light"
              style={PROSE}
            >
              {e.claim}{' '}
              {e.refIndices.map((r) => (
                <sup key={r}>
                  <a
                    href={`#ref-${r}`}
                    className="ml-0.5 font-mono text-[0.65rem] text-accent transition-colors hover:text-accent-hover"
                  >
                    [{r + 1}]
                  </a>
                </sup>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="anim-rise mb-12"
        style={{ animationDelay: mistakesDelay }}
        aria-label={l.mistakes}
      >
        <SectionHeader index={mistakesNum} label={l.mistakes} />
        <ul className="space-y-2.5">
          {c.commonMistakes.map((p, i) => (
            <li key={i} className="flex items-start gap-4">
              <span
                className="mt-0.5 w-5 shrink-0 font-mono text-xs text-label select-none"
                aria-hidden="true"
              >
                ×
              </span>
              <span className="text-base leading-relaxed text-main" style={PROSE}>
                {renderEmphasis(p)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {hasVariations && variationsNum !== null && c.variations !== undefined && (
        <section
          className="anim-rise mb-12"
          style={{ animationDelay: variationsDelay ?? undefined }}
          aria-label={l.variations}
        >
          <SectionHeader index={variationsNum} label={l.variations} />
          <ul className="space-y-5">
            {c.variations.map((v, i) => (
              <li
                key={i}
                className="border-l-2 border-rule pl-5 transition-colors hover:border-accent-dim"
              >
                <p className="mb-1 font-display text-lg uppercase text-title">{v.name}</p>
                <p className="text-sm leading-relaxed text-muted" style={PROSE}>
                  {renderEmphasis(v.detail)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        className="anim-rise"
        style={{ animationDelay: referencesDelay }}
        aria-label={l.references}
      >
        <SectionHeader index={referencesNum} label={l.references} />
        {/* Bibliography hanging indent: padding-left + negative text-indent. */}
        <ol
          data-testid="exercise-references"
          className="space-y-3 text-sm leading-relaxed text-muted"
          style={{ paddingLeft: '2.25rem' }}
        >
          {article.references.map((r, i) => (
            <li key={i} id={`ref-${i}`} style={{ textIndent: '-2.25rem' }}>
              <span className="mr-2 font-mono text-xs text-accent select-none">[{i + 1}]</span>
              {r.authors} ({r.year}).{' '}
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="text-main underline decoration-rule underline-offset-2 transition-colors hover:text-title"
              >
                {r.title}
              </a>
              {r.doi !== undefined ? (
                <span className="ml-1 font-mono text-xs text-label">doi:{r.doi}</span>
              ) : r.pmid !== undefined ? (
                <span className="ml-1 font-mono text-xs text-label">PMID:{r.pmid}</span>
              ) : (
                ''
              )}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
