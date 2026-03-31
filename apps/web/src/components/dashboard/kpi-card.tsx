import { cn } from '@/lib/cn';

interface KpiCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly sub?: string;
  readonly accent?: boolean;
  readonly loading?: boolean;
}

export function KpiCard({
  label,
  value,
  sub,
  accent = false,
  loading = false,
}: KpiCardProps): React.ReactNode {
  if (loading) {
    return (
      <div className="bg-card border border-rule p-5 animate-pulse">
        <div className="h-2.5 w-20 bg-rule rounded mb-3" />
        <div className="h-7 w-16 bg-rule rounded" />
      </div>
    );
  }

  return (
    <div className={cn('bg-card border border-rule p-5 card', accent && 'accent-left-gold')}>
      <p className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-2">
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
      {sub && <p className="text-xs text-muted mt-1.5">{sub}</p>}
    </div>
  );
}
