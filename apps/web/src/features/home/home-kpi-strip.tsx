import type { FrequencyPayload } from '@/lib/insight-payloads';
import { KpiCard } from '@/features/dashboard/kpi-card';

interface HomeKpiStripProps {
  readonly freqPayload: FrequencyPayload | null;
  readonly isLoading: boolean;
}

export function HomeKpiStrip({ freqPayload, isLoading }: HomeKpiStripProps): React.ReactNode {
  if (!freqPayload && !isLoading) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      <KpiCard
        label="Racha"
        value={freqPayload?.currentStreak ?? 0}
        sub="seguidos"
        accent
        loading={isLoading}
      />
      <KpiCard
        label="Sesiones/sem"
        value={freqPayload?.sessionsPerWeek ?? 0}
        sub="frecuencia"
        loading={isLoading}
      />
      <KpiCard
        label="Consistencia"
        value={freqPayload ? `${Math.round(freqPayload.consistencyPct)}%` : '0%'}
        sub={freqPayload ? `${freqPayload.totalSessions} total` : undefined}
        loading={isLoading}
      />
    </div>
  );
}
