import { Link } from '@tanstack/react-router';
import { FadeUp } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';
import type { FaqContent, FinalCtaContent } from './content';
import { buildFaqJsonLd } from './faq-content';
import { trackEvent } from '@/lib/analytics';

interface FaqSectionProps {
  readonly content: FaqContent;
  readonly finalCta: FinalCtaContent;
}

export function FaqSection({ content, finalCta }: FaqSectionProps): React.ReactNode {
  const jsonLd = buildFaqJsonLd(content.items);
  const jsonLdText = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  return (
    <section id="faq" aria-labelledby="faq-heading" className={`${SECTION_PAD} max-w-5xl mx-auto`}>
      <script type="application/ld+json">{jsonLdText}</script>
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

      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
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

      <FadeUp className="relative mt-10 overflow-hidden border border-accent/30 bg-card px-6 py-10 sm:px-10 text-center">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: 'url(/landing-final-cta-bg.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-accent mb-4">
            {finalCta.eyebrow}
          </p>
          <h2
            className="font-display leading-none text-title mb-6"
            style={{ fontSize: 'clamp(36px, 5vw, 64px)', letterSpacing: '0.02em' }}
          >
            {finalCta.line1}
            <br />
            <span className="text-main">{finalCta.line2}</span>
          </h2>
          <Link
            to="/login"
            onClick={() => trackEvent('landing_cta_click', { location: 'final_cta' })}
            className="font-mono inline-block px-10 py-4 text-sm font-bold tracking-widest uppercase border-2 border-btn-ring bg-btn-active text-btn-active-text transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-body"
          >
            {finalCta.cta}
          </Link>
          <p className="font-mono text-[10px] tracking-wider text-muted mt-3">
            {finalCta.microcopy}
          </p>
        </div>
      </FadeUp>
    </section>
  );
}
