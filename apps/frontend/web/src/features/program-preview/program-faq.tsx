import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgramFaqEntry } from '@/lib/catalog-display';

interface Props {
  readonly items: readonly ProgramFaqEntry[];
}

interface FaqJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'FAQPage';
  readonly mainEntity: ReadonlyArray<{
    readonly '@type': 'Question';
    readonly name: string;
    readonly acceptedAnswer: { readonly '@type': 'Answer'; readonly text: string };
  }>;
}

function buildFaqJsonLd(items: readonly ProgramFaqEntry[]): FaqJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/**
 * Per-program FAQ — visible Q&A plus matching FAQPage JSON-LD. Self-contained
 * question/answer pairs are the highest-value format for AI answer-engine
 * extraction (ChatGPT/Perplexity/AI Overviews), and the rendered text mirrors
 * the structured data exactly (both read from the same `items`).
 */
export function ProgramFaq({ items }: Props): ReactNode {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  const jsonLdText = JSON.stringify(buildFaqJsonLd(items)).replace(/</g, '\\u003c');

  return (
    <section aria-labelledby="program-faq-heading" className="mt-8">
      <script type="application/ld+json">{jsonLdText}</script>
      <h2
        id="program-faq-heading"
        className="font-display text-title mb-4 text-lg uppercase tracking-wide"
      >
        {t('catalog.program_preview.faq_title')}
      </h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <details key={item.question} className="group bg-card border border-rule overflow-hidden">
            <summary
              className={[
                'flex items-center justify-between gap-4 px-5 py-3 cursor-pointer',
                'text-sm font-bold text-main',
                'list-none select-none',
                'hover:bg-white/[0.03] transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
              ].join(' ')}
            >
              <span>{item.question}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0 text-accent transition-transform duration-200 group-open:rotate-180"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </summary>
            <p className="px-5 pb-4 pt-1 text-sm leading-relaxed text-muted border-t border-rule">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
