import { useMemo } from 'react';
import { LineChart } from '@/components/charts/line-chart';
import type { InsightItem } from '@/lib/api-functions';
import type { ChartDataPoint } from '@gzclp/shared/types';

interface E1rmPayload {
  dates: string[];
  e1rms: number[];
  currentMax: number;
}

function isE1rmPayload(v: unknown): v is E1rmPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'dates' in v &&
    Array.isArray(v.dates) &&
    'e1rms' in v &&
    Array.isArray(v.e1rms) &&
    'currentMax' in v &&
    typeof v.currentMax === 'number'
  );
}

interface E1rmChartProps {
  readonly insight: InsightItem;
  readonly exerciseName?: string;
}

export function E1rmChart({ insight, exerciseName }: E1rmChartProps): React.ReactNode {
  const payload = insight.payload;
  if (!isE1rmPayload(payload)) return null;

  const data = useMemo<ChartDataPoint[]>(
    () =>
      payload.dates.map((date, i) => ({
        workout: i + 1,
        weight: payload.e1rms[i] ?? 0,
        stage: 0,
        result: 'success' as const,
        date: date.startsWith('#') ? undefined : date,
      })),
    [payload]
  );

  const label = exerciseName
    ? `1RM estimado — ${exerciseName}`
    : `1RM estimado — ${insight.exerciseId ?? ''}`;

  return (
    <div className="bg-card border border-rule card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest">
          {exerciseName ?? insight.exerciseId ?? 'Ejercicio'}
        </h3>
        <span className="font-mono text-[10px] text-muted">máx: {payload.currentMax} kg</span>
      </div>
      <LineChart data={data} label={label} mode="weight" yAxisLabel="kg" />
    </div>
  );
}
