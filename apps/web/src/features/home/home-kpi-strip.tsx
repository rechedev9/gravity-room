import { useTranslation } from 'react-i18next';
import type { FrequencyPayload } from '@/lib/insight-payloads';
import { KpiCard } from '@/features/dashboard/kpi-card';

interface HomeKpiStripProps {
  readonly freqPayload: FrequencyPayload | null;
  readonly isLoading: boolean;
}

export function HomeKpiStrip({ freqPayload, isLoading }: HomeKpiStripProps): React.ReactNode {
  const { t } = useTranslation();

  if (!freqPayload && !isLoading) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      <KpiCard
        label={t('home.kpi.streak_label')}
        value={freqPayload?.currentStreak ?? 0}
        sub={t('home.kpi.streak_sub')}
        accent
        loading={isLoading}
      />
      <KpiCard
        label={t('home.kpi.sessions_label')}
        value={freqPayload?.sessionsPerWeek ?? 0}
        sub={t('home.kpi.sessions_sub')}
        loading={isLoading}
      />
      <KpiCard
        label={t('home.kpi.consistency_label')}
        value={freqPayload ? `${Math.round(freqPayload.consistencyPct)}%` : '0%'}
        sub={
          freqPayload
            ? t('home.kpi.consistency_sub_total', { count: freqPayload.totalSessions })
            : undefined
        }
        loading={isLoading}
      />
    </div>
  );
}
