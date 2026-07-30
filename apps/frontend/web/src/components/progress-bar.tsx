import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Minimum fill width (%) so a single completed unit is still visible on a long
 * track (e.g. 1/90 rounds to 1% and would otherwise read as empty).
 */
export const PROGRESS_MIN_VISIBLE_PCT = 4;

interface ProgressBarProps {
  readonly completed: number;
  readonly total: number;
  readonly ariaLabel: string;
  readonly showPercent?: boolean;
  readonly className?: string;
}

/** Visible fill width for the bar — not the same as the numeric percent label. */
export function progressFillPercent(completed: number, total: number): number {
  if (total <= 0 || completed <= 0) return 0;
  const pct = Math.min(100, Math.round((completed / total) * 100));
  if (completed >= total) return 100;
  return Math.max(pct, PROGRESS_MIN_VISIBLE_PCT);
}

export function ProgressBar({
  completed,
  total,
  ariaLabel,
  showPercent = false,
  className,
}: ProgressBarProps): ReactNode {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const fillPct = progressFillPercent(completed, total);
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
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span className="font-mono text-xs font-bold text-muted whitespace-nowrap tabular-nums">
        {completed}/{total}
        {showPercent && ` (${pct}%)`}
      </span>
    </div>
  );
}
