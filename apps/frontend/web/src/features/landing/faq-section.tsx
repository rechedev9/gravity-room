import { FadeUp } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';
import type { FaqContent } from './content';
import { buildFaqJsonLd } from './faq-content';

interface FaqSectionProps {
  readonly content: FaqContent;
}

export function FaqSection({ content }: FaqSectionProps): React.ReactNode {
  const jsonLd = buildFaqJsonLd(content.items);
  return (
    <section id="faq" aria-labelledby="faq-heading" className={`${SECTION_PAD} max-w-3xl mx-auto`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FadeUp className="text-center mb-12">
        <SectionLabel>{content.sectionLabel}</SectionLabel>
        <h2
          id="faq-heading"
          className="font-display leading-none text-title mb-4"
          style={{ fontSize: 'clamp(28px, 4vw, 48px)', letterSpacing: '0.02em' }}
        >
          {content.title}
        </h2>
      </FadeUp>

      <div className="flex flex-col gap-3">
        {content.items.map((item) => (
          <details
            key={item.question}
            className="group bg-card border border-rule landing-card-glow overflow-hidden"
          >
            <summary
              className={[
                'flex items-center justify-between gap-4 px-6 py-4 cursor-pointer',
                'text-sm font-bold uppercase tracking-wider text-main',
                'list-none select-none',
                'hover:bg-white/[0.03] transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
              ].join(' ')}
            >
              <span>{item.question}</span>
              {/* Chevron — rotates when open via group-open */}
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
            <p className="px-6 pb-5 pt-1 text-sm leading-relaxed text-muted border-t border-rule">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
