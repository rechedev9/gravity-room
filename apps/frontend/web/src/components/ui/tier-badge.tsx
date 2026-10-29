import { cn } from '@/lib/cn';

export type Tier = 'T1' | 'T2' | 'T3';

export interface TierBadgeProps {
  readonly tier: Tier;
  readonly className?: string;
}

/**
 * A small boxed tier badge. T1 is the scarce accent signal; T2/T3 stay muted.
 * Uses the `type-meta` mono scale (12px) so it never falls below 11px.
 */
export function TierBadge({ tier, className }: TierBadgeProps): React.ReactNode {
  const isPrimary = tier === 'T1';
  return (
    <span
      className={cn(
        'type-meta inline-flex items-center rounded-control border px-1.5 py-0.5 font-mono',
        isPrimary ? 'border-accent-dim text-accent' : 'border-rule-light text-muted',
        className
      )}
    >
      {tier}
    </span>
  );
}
