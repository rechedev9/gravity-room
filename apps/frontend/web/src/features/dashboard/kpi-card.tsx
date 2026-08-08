import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useCountUp } from './use-count-up';

type KpiVariant = 'default' | 'flame';

interface KpiCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly sub?: string;
  readonly accent?: boolean;
  readonly variant?: KpiVariant;
  readonly loading?: boolean;
  readonly trend?: 'up' | 'down' | 'flat' | null;
  readonly trendLabel?: string;
  readonly progress?: {
    readonly value: number;
    readonly label: string;
  };
}

export function KpiCard({
  label,
  value,
  sub,
  accent = false,
  variant = 'default',
  loading = false,
  trend = null,
  trendLabel,
  progress,
}: KpiCardProps): React.ReactNode {
  const { t } = useTranslation();
  const display = useCountUp(value);
  const progressValue = progress ? Math.min(1, Math.max(0, progress.value)) : 0;

  if (loading) {
    return (
      <div
        className="bg-card border border-rule p-4 sm:p-5 animate-pulse rounded-[var(--radius-base)]"
        aria-busy="true"
        aria-label={t('dashboard.kpi_card.loading_label')}
      >
        <div className="h-2.5 w-20 bg-rule rounded mb-3" />
        <div className="h-7 w-16 bg-rule rounded" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-card border border-rule rounded-[var(--radius-base)] p-5 shadow-[var(--shadow-card)] min-h-28',
        accent && 'border-t-2 border-t-accent'
      )}
    >
      <p className="chalk-stamp mb-2">{label}</p>
      <p
        className={cn(
          'font-display-data text-4xl leading-none tabular-nums',
          variant === 'flame' ? 'text-victory' : 'text-main'
        )}
      >
        {variant === 'flame' && <span className="mr-1">▲</span>}
        {display}
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
      {progress && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-progress-track"
          role="progressbar"
          aria-label={progress.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressValue * 100)}
        >
          <span
            className="block h-full rounded-full bg-accent transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-expo)]"
            style={{ width: `${progressValue * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
