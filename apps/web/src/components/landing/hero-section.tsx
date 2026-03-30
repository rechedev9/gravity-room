import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { EASE_OUT_EXPO, fadeUpVariants } from '@/lib/motion-primitives';

export function HeroSection(): React.ReactNode {
  const reduced = useReducedMotion();
  const init = reduced ? 'visible' : 'hidden';
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -60]);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative px-6 pt-24 pb-12 sm:pt-32 sm:pb-16 overflow-hidden"
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(232,170,32,0.08) 0%, transparent 65%)',
        }}
      />

      <div
        className="absolute left-[8%] top-0 bottom-0 w-px pointer-events-none hidden lg:block"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, var(--color-rule) 30%, var(--color-rule) 70%, transparent 100%)',
        }}
      />
      <div
        className="absolute right-[8%] top-0 bottom-0 w-px pointer-events-none hidden lg:block"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, var(--color-rule) 30%, var(--color-rule) 70%, transparent 100%)',
        }}
      />

      <motion.div
        initial={init}
        animate="visible"
        transition={{ staggerChildren: reduced ? 0 : 0.12 }}
        className="max-w-4xl mx-auto text-center"
      >
        <motion.div
          variants={fadeUpVariants}
          className="font-mono inline-flex items-center gap-3 mb-8 px-4 py-2 border border-rule-light bg-card"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-muted">
            100% Gratis &middot; Sincroniza entre Dispositivos
          </span>
        </motion.div>

        <motion.h1
          id="hero-heading"
          variants={fadeUpVariants}
          className="font-display mb-6 leading-none tracking-wide text-title"
          style={{
            fontSize: 'clamp(72px, 12vw, 140px)',
            letterSpacing: '0.02em',
          }}
        >
          Entrena Mejor.
          <br />
          <span className="text-main" style={{ opacity: 0.9 }}>
            Progresa Más Rápido.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUpVariants}
          className="text-base sm:text-lg max-w-xl mx-auto mb-12 leading-relaxed text-muted"
        >
          Deja de adivinar en el gimnasio. Sigue programas probados que ajustan automáticamente el
          peso, series y repeticiones — para que cada sesión te haga avanzar.
        </motion.p>

        <motion.div
          variants={fadeUpVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/login"
            className="font-mono px-10 py-4 text-sm font-bold tracking-widest uppercase border-2 border-btn-ring bg-btn-active text-btn-active-text hover:shadow-[0_0_32px_rgba(232,170,32,0.35)] transition-all duration-300 min-w-[220px]"
          >
            Comenzar →
          </Link>
          <a
            href="#how-it-works"
            className="font-mono px-10 py-4 text-sm font-bold tracking-widest uppercase border-2 border-rule text-muted hover:border-rule-light hover:text-main transition-all duration-300 min-w-[220px]"
          >
            Cómo Funciona
          </a>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, scale: 0.96 },
            visible: {
              opacity: 1,
              scale: 1,
              transition: { duration: 0.8, ease: EASE_OUT_EXPO },
            },
          }}
          style={reduced ? undefined : { y: heroY }}
          className="mt-12 relative max-w-2xl mx-auto"
        >
          <div
            className="absolute inset-0 -m-4 rounded-lg pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(232,170,32,0.12) 0%, transparent 70%)',
            }}
          />
          <img
            src="/hero.webp"
            alt="Gravity Room — training chamber with gravity levels"
            width={1024}
            height={572}
            className="relative w-full h-auto rounded-sm border border-rule shadow-2xl"
            loading="eager"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
