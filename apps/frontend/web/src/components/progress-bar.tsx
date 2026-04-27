import type { ReactNode } from 'react';

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
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div
      className={`flex items-center gap-3 ${className ?? ''}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div className="flex-1 h-2.5 bg-progress-track overflow-hidden rounded-full">
        <div
          className="h-full bg-accent transition-[width] duration-300 ease-out progress-fill rounded-full"
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
