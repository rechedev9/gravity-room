import type { CSSProperties, ReactNode } from 'react';
import { useInViewport } from '@/hooks/use-in-viewport';

type MotionTag = 'div' | 'section' | 'p';
type RevealStyle = CSSProperties & Record<'--landing-delay', string>;
type StaggerStyle = CSSProperties & Record<'--landing-stagger', string>;

interface RevealProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delay?: number;
  readonly as?: MotionTag;
}

function revealProps(
  ref: React.RefCallback<HTMLElement>,
  visible: boolean,
  className: string | undefined,
  delay: number
): {
  ref: React.RefCallback<HTMLElement>;
  className: string;
  'data-visible': boolean;
  style: RevealStyle;
} {
  return {
    ref,
    className: ['landing-reveal', visible && 'landing-reveal-visible', className]
      .filter(Boolean)
      .join(' '),
    'data-visible': visible,
    style: { '--landing-delay': `${delay}s` },
  };
}

export function FadeUp({ children, className, delay = 0, as = 'div' }: RevealProps): ReactNode {
  const [ref, visible] = useInViewport({ rootMargin: '0px 0px -40px 0px' });
  const props = revealProps(ref, visible, className, delay);

  if (as === 'section') return <section {...props}>{children}</section>;
  if (as === 'p') return <p {...props}>{children}</p>;
  return <div {...props}>{children}</div>;
}

interface StaggerContainerProps {
  readonly children: ReactNode;
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
}: StaggerContainerProps): ReactNode {
  const [ref, visible] = useInViewport({ rootMargin: '0px 0px -40px 0px' });
  const staggerStyle: StaggerStyle = { '--landing-stagger': `${stagger}s` };
  const props = {
    ...revealProps(ref, visible, ['landing-stagger', className].filter(Boolean).join(' '), 0),
    ...rest,
    style: staggerStyle,
  };

  if (as === 'section') return <section {...props}>{children}</section>;
  return <div {...props}>{children}</div>;
}

export function StaggerItem({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}): ReactNode {
  return (
    <div className={['landing-stagger-item', className].filter(Boolean).join(' ')}>{children}</div>
  );
}
