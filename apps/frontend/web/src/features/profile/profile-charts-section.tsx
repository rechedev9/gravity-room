import { calculateStats } from '@gzclp/domain/generic-stats';
import type { ChartDataPoint } from '@gzclp/domain/types';
import { useTranslation } from 'react-i18next';
import { DashboardCard } from '@/components/dashboard-card';
import { LineChart } from '@/components/charts/line-chart';

interface ProfileChartsSectionProps {
  readonly chartData: Record<string, ChartDataPoint[]>;
  readonly primaryExercises: readonly string[];
  readonly names: Readonly<Record<string, string>>;
  readonly toDisplay: (kg: number) => number;
  readonly unitLabel: string;
}

export function ProfileChartsSection({
  chartData,
  primaryExercises,
  names,
  toDisplay,
  unitLabel,
}: ProfileChartsSectionProps): React.ReactNode {
  const { t } = useTranslation();

  return (
    <div className="mt-6">
      <DashboardCard title={t('profile.charts.weight_progression_title')}>
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted">
          {t('profile.charts.description')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {primaryExercises.map((ex) => {
            const data = chartData[ex];
            if (!data) return null;
            const stats = calculateStats(data);
            const hasMark = stats.total > 0;
            const displayData = data.map((point) => ({
              ...point,
              weight: toDisplay(point.weight),
            }));
            return (
              <div key={ex} className="border border-rule bg-th/25 p-4">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-title">{names[ex] ?? ex}</h3>
                    {hasMark && (
                      <p className="mt-1 text-2xs text-muted">
                        {t('profile.charts.logged_sessions', { count: stats.total })} ·{' '}
                        {t('profile.charts.success_rate_inline', { rate: stats.rate })}
                      </p>
                    )}
                  </div>
                  {hasMark && (
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-2xs uppercase tracking-wider text-muted">
                        {t('profile.charts.current_load')}
                      </p>
                      <p className="font-display-data text-2xl leading-none text-title tabular-nums">
                        {toDisplay(stats.currentWeight)} {unitLabel}
                      </p>
                      {stats.gained > 0 && (
                        <p className="mt-1 text-2xs font-semibold text-ok">
                          +{toDisplay(stats.gained)} {unitLabel}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <LineChart
                  data={displayData}
                  label={names[ex] ?? ex}
                  projectionHorizon={6}
                  unitLabel={unitLabel}
                />
              </div>
            );
          })}
        </div>
      </DashboardCard>
    </div>
  );
}
