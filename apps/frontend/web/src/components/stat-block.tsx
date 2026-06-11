import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatBlockProps {
  /** Mono caps label above the value. */
  readonly label: ReactNode;
  /** The headline value — rendered in the Bebas data voice. */
  readonly value: ReactNode;
  /** Optional unit/sub line under the value. */
  readonly sub?: ReactNode;
  /** Render the value in gold — reserve for the one scarce signal per view. */
  readonly gold?: boolean;
  readonly className?: string;
}

/**
 * StatBlock — the Forged Iron metric tile: mono kicker label, big Bebas value,
 * optional sub. A bordered panel; pass `gold` only for a view's single hero stat.
 */
export function StatBlock({
  label,
  value,
  sub,
  gold = false,
  className,
}: StatBlockProps): ReactNode {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-[var(--radius-base)] border border-rule bg-card px-5 py-4',
        className
      )}
    >
      <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-label">
        {label}
      </span>
      <span
        className={cn(
          'font-display-data text-[40px] leading-none tabular-nums',
          gold ? 'text-accent' : 'text-main'
        )}
      >
        {value}
      </span>
      {sub ? <span className="font-mono text-[11px] text-muted tabular-nums">{sub}</span> : null}
    </div>
  );
}
