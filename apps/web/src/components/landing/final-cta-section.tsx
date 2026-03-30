import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { fadeUpVariants, fadeInVariants, scaleUpVariants } from '@/lib/motion-primitives';

export function FinalCtaSection(): React.ReactNode {
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
            'radial-gradient(ellipse at center bottom, rgba(232,170,32,0.06) 0%, transparent 60%)',
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
          ¿Listo para subir la gravedad?
        </motion.p>
        <motion.h2
          variants={fadeUpVariants}
          className="font-display mb-10 leading-none text-title"
          style={{
            fontSize: 'clamp(52px, 8vw, 100px)',
            letterSpacing: '0.02em',
          }}
        >
          Entra a la Gravity Room.
          <br />
          <span className="text-main" style={{ opacity: 0.8 }}>
            Comienza a Entrenar Hoy.
          </span>
        </motion.h2>
        <motion.div variants={scaleUpVariants}>
          <Link
            to="/login"
            className="font-mono inline-block px-12 py-4 text-sm font-bold tracking-widest uppercase border-2 border-btn-ring bg-btn-active text-btn-active-text hover:shadow-[0_0_48px_rgba(232,170,32,0.4)] transition-all duration-300"
          >
            Comienza Gratis →
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
