import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';
import type { FreeTrustContent } from './content';

/* ── Trust pillar icons ──────────────────────────────────────────────────── */

const TRUST_ICONS: readonly React.ReactNode[] = [
  /* Free / price tag */
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M12 6v2M12 16v2M9 12h6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  /* No ads / block */
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M4.93 4.93l14.14 14.14" strokeLinecap="round" />
  </svg>,
  /* Data / shield */
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>,
  /* Open source / code */
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <polyline points="16 18 22 12 16 6" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="8 6 2 12 8 18" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
];

interface FreeTrustSectionProps {
  readonly content: FreeTrustContent;
}

export function FreeTrustSection({ content }: FreeTrustSectionProps): React.ReactNode {
  return (
    <section
      id="free-trust"
      aria-labelledby="free-trust-heading"
      className={`${SECTION_PAD} max-w-5xl mx-auto`}
    >
      {/* Header */}
      <FadeUp className="text-center mb-8">
        <SectionLabel>{content.sectionLabel}</SectionLabel>
        <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted mb-3">
          {content.eyebrow}
        </p>
        <h2
          id="free-trust-heading"
          className="font-display leading-none text-title mb-4"
          style={{ fontSize: 'clamp(32px, 5vw, 56px)', letterSpacing: '0.02em' }}
        >
          {content.title}
        </h2>
        <p className="text-base leading-relaxed text-muted max-w-xl mx-auto">{content.body}</p>
      </FadeUp>

      <StaggerContainer
        stagger={0.08}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-rule"
      >
        {content.items.map((item, idx) => (
          <StaggerItem key={item.title} className="relative bg-card p-5 group cursor-default">
            <div className="mb-4 group-hover:scale-110 origin-left transition-transform duration-300 text-accent">
              {TRUST_ICONS[idx]}
            </div>
            <div className="text-sm font-bold mb-1 uppercase tracking-wider text-main">
              {item.title}
            </div>
            <p className="text-sm leading-relaxed text-muted">{item.desc}</p>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
