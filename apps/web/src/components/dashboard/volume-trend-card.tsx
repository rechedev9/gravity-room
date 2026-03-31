import { useMemo } from 'react';
import { BarChart } from '@/components/charts/bar-chart';
import type { InsightItem } from '@/lib/api-functions';
import type { VolumeDataPoint } from '@gzclp/shared/types';
import { isVolumeTrendPayload } from '@/lib/insight-payloads';

interface VolumeTrendCardProps {
  readonly insight: InsightItem;
}

export function VolumeTrendCard({ insight }: VolumeTrendCardProps): React.ReactNode {
  const payload = insight.payload;

  if (!isVolumeTrendPayload(payload)) return null;

  const data = useMemo<VolumeDataPoint[]>(
    () =>
      payload.weeks.map((week, i) => ({
        workout: i + 1,
        volumeKg: payload.volumes[i] ?? 0,
        date: week,
      })),
    [payload]
  );

  const directionLabel =
    payload.direction === 'up'
      ? '↑ subiendo'
      : payload.direction === 'down'
        ? '↓ bajando'
        : '→ estable';

  return (
    <div className="bg-card border border-rule card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest">
          Tendencia de Volumen
        </h3>
        <span className="font-mono text-[10px] text-muted">{directionLabel}</span>
      </div>
      <BarChart data={data} label="Volumen semanal (kg)" />
    </div>
  );
}
