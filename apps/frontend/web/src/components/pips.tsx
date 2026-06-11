import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PipsProps {
  /** Total number of segments (e.g. total sets). */
  readonly total: number;
  /** Number of completed (passed) segments — filled gold. */
  readonly done: number;
  /** Number of failed segments — filled with the dim-fail tone. */
  readonly fail?: number;
  /** Accessible label describing what the pips track. */
  readonly ariaLabel: string;
  readonly className?: string;
}

/**
 * Pips — plate-segment progress, the Forged Iron replacement for a progress bar.
 * Each set is a discrete machined segment; gold = passed, dim-fail = missed,
 * empty = pending. Exposes `role="progressbar"` so it remains a drop-in for
 * ProgressBar's accessibility contract.
 */
export function Pips({ total, done, fail = 0, ariaLabel, className }: PipsProps): ReactNode {
  const logged = Math.min(total, done + fail);
  const doneCount = Math.min(done, total);
  const failCount = Math.min(fail, total - doneCount);
  const empty = Math.max(0, total - doneCount - failCount);

  const segments: Array<'done' | 'fail' | 'empty'> = [
    ...Array<'done'>(doneCount).fill('done'),
    ...Array<'fail'>(failCount).fill('fail'),
    ...Array<'empty'>(empty).fill('empty'),
  ];

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={logged}
      className={cn('flex items-center gap-1', className)}
    >
      {segments.map((kind, i) => (
        <span
          key={`${kind}-${i}`}
          className={cn(
            'h-2.5 flex-1 rounded-[1px] border',
            kind === 'done' && 'bg-accent border-accent-hover',
            kind === 'fail' && 'bg-fail-ring border-fail',
            kind === 'empty' && 'bg-surface-2 border-rule'
          )}
        />
      ))}
    </div>
  );
}
