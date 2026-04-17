import { FadeUp, StaggerContainer, StaggerItem, scaleUpVariants } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';
import type { ScienceContent } from './content';

/* ── Science card icons (language-independent SVGs) ─────────────────────── */

const SCIENCE_ICONS: readonly React.ReactNode[] = [
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="mx-auto"
    aria-hidden="true"
  >
    <path d="M23 6l-9.5 9.5-5-5L1 18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="mx-auto"
    aria-hidden="true"
  >
    <path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="mx-auto"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
];

interface ScienceSectionProps {
  readonly content: ScienceContent;
}

export function ScienceSection({ content }: ScienceSectionProps): React.ReactNode {
  return (
    <section
      aria-labelledby="smart-training-heading"
      className={`${SECTION_PAD} max-w-5xl mx-auto`}
    >
      <FadeUp>
        <SectionLabel>{content.sectionLabel}</SectionLabel>
      </FadeUp>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        {/* Left: headline + description */}
        <FadeUp>
          <h2
            id="smart-training-heading"
            className="font-display mb-5 leading-none text-title"
            style={{ fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '0.02em' }}
          >
            {content.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted sm:text-base sm:leading-relaxed">
            {content.body}
          </p>
        </FadeUp>

        {/* Right: stacked cards */}
        <StaggerContainer stagger={0.1} className="flex flex-col gap-4">
          {content.cards.map((card, idx) => (
            <StaggerItem
              key={card.title}
              variants={scaleUpVariants}
              className="relative bg-card border border-rule p-5 landing-card-glow group cursor-default flex items-start gap-4"
            >
              <div className="shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300 text-accent">
                {SCIENCE_ICONS[idx]}
              </div>
              <div>
                <div className="text-sm font-bold mb-1 uppercase tracking-wider text-main">
                  {card.title}
                </div>
                <p className="text-sm leading-relaxed text-muted">{card.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
