import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import {
  FadeUp,
  StaggerContainer,
  StaggerItem,
  scaleUpVariants,
  fadeInVariants,
} from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';
import { trackEvent } from '@/lib/analytics';
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
  const reduced = useReducedMotion();
  const init = reduced ? 'visible' : 'hidden';

  return (
    <section
      id="free-trust"
      aria-labelledby="free-trust-heading"
      className={`${SECTION_PAD} max-w-5xl mx-auto`}
    >
      {/* Header */}
      <FadeUp className="text-center mb-12">
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
        <p className="text-sm leading-relaxed text-muted max-w-xl mx-auto">{content.body}</p>
      </FadeUp>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
        {/* Left: pricing card / highlight table */}
        <motion.div
          initial={init}
          whileInView="visible"
          viewport={{ once: true, margin: '0px 0px -40px 0px' }}
          variants={fadeInVariants}
          className="bg-card border border-rule landing-card-glow overflow-hidden"
        >
          {/* Card header */}
          <div className="px-6 py-5 border-b border-rule bg-white/[0.03]">
            <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted mb-1">
              {content.eyebrow}
            </p>
            <p className="font-display text-title text-2xl font-bold leading-tight">
              {content.title}
            </p>
          </div>

          {/* Highlight rows */}
          <ul className="divide-y divide-rule" role="list">
            {content.highlights.map((row) => (
              <li key={row.label} className="flex items-center justify-between px-6 py-4 text-sm">
                <span className="text-muted">{row.label}</span>
                <span className="font-mono font-bold text-accent text-base">{row.value}</span>
              </li>
            ))}
          </ul>

          {/* CTA inside card */}
          <div className="px-6 py-5 border-t border-rule flex flex-col items-start gap-2">
            <Link
              to="/login"
              onClick={() => trackEvent('landing_cta_click', { location: 'free_trust' })}
              className="font-mono inline-block px-8 py-3 text-xs font-bold tracking-widest uppercase border border-btn-ring text-main hover:bg-btn-active hover:text-btn-active-text hover:border-btn-ring hover:shadow-[0_0_24px_rgba(232,170,32,0.25)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {content.cta}
            </Link>
            <p className="text-[11px] text-muted/70">{content.microcopy}</p>
          </div>
        </motion.div>

        {/* Right: trust pillars */}
        <StaggerContainer stagger={0.08} className="flex flex-col gap-4">
          {content.items.map((item, idx) => (
            <StaggerItem
              key={item.title}
              variants={scaleUpVariants}
              className="relative bg-card border border-rule p-5 landing-card-glow group cursor-default flex items-start gap-4"
            >
              <div className="shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300 text-accent">
                {TRUST_ICONS[idx]}
              </div>
              <div>
                <div className="text-sm font-bold mb-1 uppercase tracking-wider text-main">
                  {item.title}
                </div>
                <p className="text-sm leading-relaxed text-muted">{item.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
