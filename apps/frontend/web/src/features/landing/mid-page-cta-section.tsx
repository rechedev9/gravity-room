import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { fadeUpVariants, fadeInVariants } from '@/lib/motion-primitives';
import { trackEvent } from '@/lib/analytics';
import type { MidPageCtaContent } from './content';

interface MidPageCtaSectionProps {
  readonly content: MidPageCtaContent;
}

/**
 * Compact CTA band placed after HowItWorksSection.
 * Intentionally lighter than the hero and final CTA — no large headline,
 * no background glow, no pattern overlay. Just a focused nudge once the
 * user understands the flow.
 */
export function MidPageCtaSection({ content }: MidPageCtaSectionProps): React.ReactNode {
  const reduced = useReducedMotion();
  const init = reduced ? 'visible' : 'hidden';

  return (
    <section
      aria-label={content.eyebrow}
      className="px-6 py-10 sm:py-14 border-y border-white/[0.06] bg-white/[0.02]"
    >
      <motion.div
        initial={init}
        whileInView="visible"
        viewport={{ once: true, margin: '0px 0px -32px 0px' }}
        transition={{ staggerChildren: reduced ? 0 : 0.1 }}
        className="max-w-2xl mx-auto flex flex-col items-center text-center gap-5"
      >
        {/* Eyebrow */}
        <motion.p
          variants={fadeInVariants}
          className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted"
        >
          {content.eyebrow}
        </motion.p>

        {/* Title — smaller than hero, larger than body */}
        <motion.h2
          variants={fadeUpVariants}
          className="font-display text-title leading-tight"
          style={{ fontSize: 'clamp(22px, 4vw, 36px)' }}
        >
          {content.title}
        </motion.h2>

        {/* Supporting body */}
        <motion.p variants={fadeInVariants} className="text-sm text-muted max-w-md leading-relaxed">
          {content.body}
        </motion.p>

        {/* CTA button — outlined style, lighter than hero's filled button */}
        <motion.div variants={fadeUpVariants} className="flex flex-col items-center gap-2">
          <Link
            to="/login"
            onClick={() => trackEvent('landing_cta_click', { location: 'mid_page_cta' })}
            className="font-mono inline-block px-8 py-3 text-xs font-bold tracking-widest uppercase border border-btn-ring text-main hover:bg-btn-active hover:text-btn-active-text hover:border-btn-ring hover:shadow-[0_0_24px_rgba(232,170,32,0.25)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-body"
          >
            {content.cta}
          </Link>
          <p className="text-[11px] text-muted/70">{content.microcopy}</p>
        </motion.div>
      </motion.div>
    </section>
  );
}
