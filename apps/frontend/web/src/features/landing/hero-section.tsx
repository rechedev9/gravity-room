import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { EASE_OUT_EXPO, fadeUpVariants } from '@/lib/motion-primitives';
import { trackEvent } from '@/lib/analytics';
import type { HeroContent, ProductPreviewContent } from './content';
import { ProductPreview } from './product-preview';

interface HeroSectionProps {
  readonly content: HeroContent;
  readonly productPreview: ProductPreviewContent;
}

export function HeroSection({ content, productPreview }: HeroSectionProps): React.ReactNode {
  const reduced = useReducedMotion();
  const init = reduced ? 'visible' : 'hidden';
  const { scrollY } = useScroll();
  const previewY = useTransform(scrollY, [0, 600], [0, -40]);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative px-6 pt-24 pb-16 sm:pt-32 sm:pb-20 overflow-hidden"
    >
      {/* Hero background image — atmospheric, behind all content */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: 'url(/landing-hero-bg.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.18,
        }}
      />
      {/* Dark gradient overlay to keep text readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(135deg, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.55) 50%, rgba(10,10,10,0.75) 100%)',
        }}
      />

      {/* Ambient radial glow */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(232,170,32,0.07) 0%, transparent 65%)',
        }}
      />

      {/* Vertical rule lines (decorative, large screens only) */}
      <div
        className="absolute left-[6%] top-0 bottom-0 w-px pointer-events-none hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, var(--color-rule) 30%, var(--color-rule) 70%, transparent 100%)',
        }}
      />
      <div
        className="absolute right-[6%] top-0 bottom-0 w-px pointer-events-none hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, var(--color-rule) 30%, var(--color-rule) 70%, transparent 100%)',
        }}
      />

      {/* Two-column grid: copy | preview — stacks on mobile */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* ── Left column: copy ── */}
        <motion.div
          initial={init}
          animate="visible"
          transition={{ staggerChildren: reduced ? 0 : 0.1 }}
          className="flex flex-col items-start text-left"
        >
          {/* Kicker / badge */}
          <motion.div
            variants={fadeUpVariants}
            className="font-mono inline-flex items-center gap-3 mb-6 px-4 py-2 border border-rule-light bg-card"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-muted">
              {content.kicker}
            </span>
          </motion.div>

          {/* H1 — descriptive product promise */}
          <motion.h1
            id="hero-heading"
            variants={fadeUpVariants}
            className="font-display mb-5 leading-none tracking-wide text-title"
            style={{
              fontSize: 'clamp(40px, 6vw, 72px)',
              letterSpacing: '0.01em',
            }}
          >
            {content.line1}
            <br />
            <span className="text-main" style={{ opacity: 0.9 }}>
              {content.line2}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUpVariants}
            className="text-base sm:text-lg max-w-lg mb-8 leading-relaxed text-muted"
          >
            {content.subtitle}
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUpVariants}
            className="flex flex-col sm:flex-row items-start gap-3 mb-4"
          >
            <Link
              to="/login"
              onClick={() => trackEvent('landing_cta_click', { location: 'hero_primary' })}
              className="font-mono px-8 py-4 text-sm font-bold tracking-widest uppercase border-2 border-btn-ring bg-btn-active text-btn-active-text hover:shadow-[0_0_32px_rgba(232,170,32,0.35)] transition-all duration-300 min-w-[220px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-body"
            >
              {content.primaryCta}
            </Link>
            <a
              href="#how-it-works"
              onClick={() => trackEvent('landing_cta_click', { location: 'hero_secondary' })}
              className="font-mono px-8 py-4 text-sm font-bold tracking-widest uppercase border-2 border-rule text-muted hover:border-rule-light hover:text-main transition-all duration-300 min-w-[220px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-body"
            >
              {content.secondaryCta}
            </a>
          </motion.div>

          {/* Microcopy — reassurance below CTA */}
          <motion.p
            variants={fadeUpVariants}
            className="font-mono text-[11px] tracking-wider text-muted mb-8"
          >
            {content.microcopy}
          </motion.p>

          {/* Proof chips */}
          <motion.ul
            variants={fadeUpVariants}
            className="flex flex-wrap gap-3"
            aria-label="Key benefits"
          >
            {content.proofItems.map((item) => (
              <li
                key={item.label}
                className="font-mono inline-flex items-center gap-2 px-3 py-1.5 border border-rule bg-card text-[11px] tracking-wide text-muted"
              >
                <span className="text-accent font-bold" aria-hidden="true">
                  {item.value}
                </span>
                {item.label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* ── Right column: product preview ── */}
        <motion.div
          initial={reduced ? 'visible' : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: reduced ? 0 : 0.3 }}
          style={reduced ? undefined : { y: previewY }}
          className="relative w-full flex justify-center lg:justify-end"
        >
          <ProductPreview
            alt={content.previewAlt}
            caption={content.previewCaption}
            labels={productPreview}
          />
        </motion.div>
      </div>
    </section>
  );
}
