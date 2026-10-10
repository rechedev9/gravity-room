import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ScreenHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Control aligned with the eyebrow, such as a secondary action. */
  readonly trailing?: ReactNode;
  readonly className?: string;
}

/**
 * Header shared by the top-level screens, mirroring the mobile ScreenHeader: gold kicker,
 * display title, quiet subtitle.
 */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
  className,
}: ScreenHeaderProps): ReactNode {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="type-kicker text-accent tracking-[2px]">{eyebrow}</p>
        {trailing}
      </div>
      <h1 className="type-display-sm sm:type-display text-title">{title}</h1>
      {subtitle ? <p className="text-sm leading-relaxed text-muted">{subtitle}</p> : null}
    </header>
  );
}
