import { useTranslation } from 'react-i18next';
import { KpiCard } from './kpi-card';

interface KpiStripProps {
  readonly streakDays: number;
  readonly totalSessions: number;
  readonly weekPr?: { readonly lift: string; readonly weight: number } | null;
}

export function KpiStripBrutalist({
  streakDays,
  totalSessions,
  weekPr,
}: KpiStripProps): React.ReactNode {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <KpiCard
        label={t('dashboard.kpi_strip.streak')}
        value={streakDays}
        sub={
          streakDays === 1 ? t('dashboard.kpi_strip.day_one') : t('dashboard.kpi_strip.day_other')
        }
        variant={streakDays >= 10 ? 'flame' : 'default'}
      />
      <KpiCard
        label={t('dashboard.kpi_strip.sessions')}
        value={totalSessions}
        sub={t('dashboard.kpi_strip.completed')}
      />
      <KpiCard
        label={t('dashboard.kpi_strip.weekly_pr')}
        value={weekPr ? `${weekPr.weight}kg` : '—'}
        sub={weekPr ? weekPr.lift : t('dashboard.kpi_strip.no_weekly_pr')}
        accent={!!weekPr}
      />
    </div>
  );
}
