import { calculateStats } from '@gzclp/domain/generic-stats';
import type { ChartDataPoint } from '@gzclp/domain/types';
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
  return (
    <div className="mt-6">
      <DashboardCard title="Progresión de Peso">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {primaryExercises.map((ex) => {
            const data = chartData[ex];
            if (!data) return null;
            const stats = calculateStats(data);
            const hasMark = stats.total > 0;
            return (
              <div key={ex} className="border border-rule p-3">
                <h3 className="text-sm font-bold text-title mb-1">{names[ex] ?? ex}</h3>
                {hasMark && (
                  <p className="text-xs text-muted mb-3">
                    {toDisplay(stats.currentWeight)} {unitLabel}
                    {stats.gained > 0 && (
                      <span className="text-ok">
                        {' '}
                        | +{toDisplay(stats.gained)} {unitLabel}
                      </span>
                    )}{' '}
                    | {stats.rate}% éxito
                  </p>
                )}
                <LineChart data={data} label={names[ex] ?? ex} />
              </div>
            );
          })}
        </div>
      </DashboardCard>
    </div>
  );
}
