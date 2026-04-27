import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { fadeUpVariants, fadeInVariants, scaleUpVariants } from '@/lib/motion-primitives';
import { DiscordIcon, DISCORD_URL } from './shared';
import { trackEvent } from '@/lib/analytics';
import type { FinalCtaContent } from './content';

interface FinalCtaSectionProps {
  readonly content: FinalCtaContent;
}

export function FinalCtaSection({ content }: FinalCtaSectionProps): React.ReactNode {
  const reduced = useReducedMotion();
  const init = reduced ? 'visible' : 'hidden';

  return (
    <section className="relative px-6 py-16 sm:py-24 text-center overflow-hidden">
      <motion.div
        initial={init}
        whileInView="visible"
        viewport={{ once: true, margin: '0px 0px -40px 0px' }}
        variants={fadeInVariants}
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center bottom, rgba(232,170,32,0.2) 0%, rgba(232,170,32,0.04) 55%, transparent 80%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: 'url(/pattern-bg.webp)',
          backgroundSize: '400px',
          backgroundRepeat: 'repeat',
        }}
      />
      <motion.div
        initial={init}
        whileInView="visible"
        viewport={{ once: true, margin: '0px 0px -40px 0px' }}
        transition={{ staggerChildren: reduced ? 0 : 0.15 }}
        className="relative z-10 max-w-2xl mx-auto"
      >
        <motion.p
          variants={fadeInVariants}
          className="font-mono text-[11px] tracking-[0.3em] uppercase mb-6 text-muted"
        >
          {content.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUpVariants}
          className="font-display mb-10 leading-none text-title"
          style={{
            fontSize: 'clamp(52px, 8vw, 100px)',
            letterSpacing: '0.02em',
          }}
        >
          {content.line1}
          <br />
          <span className="text-main" style={{ opacity: 0.8 }}>
            {content.line2}
          </span>
        </motion.h2>
        <motion.p
          variants={fadeInVariants}
          className="flex items-center justify-center gap-2 mb-8 text-sm text-muted"
        >
          <DiscordIcon className="w-4 h-4" />
          <span>
            {content.discordText}{' '}
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5865F2] hover:underline"
            >
              Discord
            </a>
          </span>
        </motion.p>
        <motion.div variants={scaleUpVariants}>
          <Link
            to="/login"
            onClick={() => trackEvent('landing_cta_click', { location: 'final_cta' })}
            className="font-mono inline-block px-12 py-4 text-sm font-bold tracking-widest uppercase border-2 border-btn-ring bg-btn-active text-btn-active-text hover:shadow-[0_0_48px_rgba(232,170,32,0.4)] transition-all duration-300"
          >
            {content.cta}
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
