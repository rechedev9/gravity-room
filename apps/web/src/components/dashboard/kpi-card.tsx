import { cn } from '@/lib/cn';

interface KpiCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly sub?: string;
  readonly accent?: boolean;
  readonly loading?: boolean;
  readonly trend?: 'up' | 'down' | 'flat' | null;
  readonly trendLabel?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  accent = false,
  loading = false,
  trend = null,
  trendLabel,
}: KpiCardProps): React.ReactNode {
  if (loading) {
    return (
      <div className="bg-card border border-rule p-4 sm:p-5 animate-pulse" aria-busy="true">
        <div className="h-2.5 w-20 bg-rule rounded mb-3" />
        <div className="h-7 w-16 bg-rule rounded" />
      </div>
    );
  }

  return (
    <div className={cn('bg-card border border-rule p-4 sm:p-5 card', accent && 'accent-left-gold')}>
      <p className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
        {label}
      </p>
      <p
        className={cn(
          'font-display-data text-3xl leading-none',
          accent ? 'text-title' : 'text-main'
        )}
      >
        {value}
      </p>
      <div className="flex items-center gap-2 mt-1.5 min-h-[18px]">
        {sub && <span className="text-xs text-muted">{sub}</span>}
        {trend && (
          <span
            className={cn(
              'font-mono text-[10px] font-bold',
              trend === 'up' && 'text-ok',
              trend === 'down' && 'text-fail',
              trend === 'flat' && 'text-muted'
            )}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            {trendLabel && ` ${trendLabel}`}
          </span>
        )}
      </div>
    </div>
  );
}
