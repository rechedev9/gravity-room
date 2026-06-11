import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CornerTicksProps {
  /** Tick arm length in px. */
  readonly size?: number;
  /** Tailwind border-color class for the ticks. Defaults to the dim-gold signal. */
  readonly colorClass?: string;
  /** Inset from the panel edge in px. */
  readonly inset?: number;
}

/**
 * CornerTicks — register marks in the four corners of a panel, the
 * "this is the focal panel" Forged Iron marker (replaces the old halo glow).
 * Purely decorative; the parent must be `relative`.
 */
export function CornerTicks({
  size = 8,
  colorClass = 'border-accent-dim',
  inset = 0,
}: CornerTicksProps): ReactNode {
  const dim = { width: size, height: size };
  const pos = `${inset}px`;
  return (
    <span aria-hidden className="pointer-events-none">
      <span
        className={cn('absolute border-t border-l', colorClass)}
        style={{ ...dim, top: pos, left: pos }}
      />
      <span
        className={cn('absolute border-t border-r', colorClass)}
        style={{ ...dim, top: pos, right: pos }}
      />
      <span
        className={cn('absolute border-b border-l', colorClass)}
        style={{ ...dim, bottom: pos, left: pos }}
      />
      <span
        className={cn('absolute border-b border-r', colorClass)}
        style={{ ...dim, bottom: pos, right: pos }}
      />
    </span>
  );
}
