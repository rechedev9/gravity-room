import { type Variants, motion, useReducedMotion } from 'motion/react';

/* ── Shared easing ────────────────────────────────── */

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/* ── Variant presets ──────────────────────────────── */

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT_EXPO } },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
};

export const scaleUpVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
};

/* ── Wrapper components ───────────────────────────── */

interface FadeUpProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly delay?: number;
  readonly as?: 'div' | 'section' | 'p';
}

export function FadeUp({
  children,
  className,
  delay = 0,
  as = 'div',
}: FadeUpProps): React.ReactNode {
  const reduced = useReducedMotion();
  const Tag = as === 'section' ? motion.section : as === 'p' ? motion.p : motion.div;
  return (
    <Tag
      variants={fadeUpVariants}
      initial={reduced ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </Tag>
  );
}

interface StaggerContainerProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly stagger?: number;
  readonly as?: 'div' | 'section';
  readonly id?: string;
  readonly 'aria-labelledby'?: string;
  readonly 'aria-label'?: string;
}

export function StaggerContainer({
  children,
  className,
  stagger = 0.08,
  as = 'div',
  ...rest
}: StaggerContainerProps): React.ReactNode {
  const reduced = useReducedMotion();
  const Tag = as === 'section' ? motion.section : motion.div;
  return (
    <Tag
      initial={reduced ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ staggerChildren: reduced ? 0 : stagger }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

interface StaggerItemProps {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly variants?: Variants;
  readonly style?: React.CSSProperties;
  readonly onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  readonly onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}

export function StaggerItem({
  children,
  className,
  variants = fadeUpVariants,
  ...rest
}: StaggerItemProps): React.ReactNode {
  return (
    <motion.div variants={variants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}
