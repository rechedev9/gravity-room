import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ProgressBarProps {
  readonly completed: number;
  readonly total: number;
  readonly ariaLabel: string;
  readonly showPercent?: boolean;
  readonly className?: string;
}

export function ProgressBar({
  completed,
  total,
  ariaLabel,
  showPercent = false,
  className,
}: ProgressBarProps): ReactNode {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const done = total > 0 && completed >= total;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      className={cn('flex items-center gap-3', className)}
    >
      <div className="flex-1 h-2.5 bg-progress-track rounded-full overflow-hidden">
        <div
          data-fill
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out progress-fill',
            done ? 'bg-victory shadow-[var(--shadow-victory)]' : 'bg-accent'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs font-bold text-muted whitespace-nowrap tabular-nums">
        {completed}/{total}
        {showPercent && ` (${pct}%)`}
      </span>
    </div>
  );
}
