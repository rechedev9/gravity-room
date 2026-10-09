import { useTranslation } from 'react-i18next';
import { KpiCard } from './kpi-card';
import { useUnitPreference } from '@/hooks/use-unit-preference';

interface KpiStripProps {
  readonly streakDays: number;
  readonly totalSessions: number;
  readonly totalWorkouts: number;
  readonly weekPr?: { readonly lift: string; readonly weight: number } | null;
}

export function KpiStripBrutalist({
  streakDays,
  totalSessions,
  totalWorkouts,
  weekPr,
}: KpiStripProps): React.ReactNode {
  const { t } = useTranslation();
  const { format } = useUnitPreference();
  const completed = Math.min(totalSessions, totalWorkouts);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <KpiCard
        label={t('dashboard.kpi_strip.streak')}
        value={streakDays}
        sub={
          streakDays === 1
            ? t('dashboard.kpi_strip.session_one')
            : t('dashboard.kpi_strip.session_other')
        }
        variant={streakDays >= 10 ? 'flame' : 'default'}
      />
      <KpiCard
        label={t('dashboard.kpi_strip.sessions')}
        value={totalSessions}
        sub={t('dashboard.kpi_strip.completed')}
      />
      {weekPr ? (
        <KpiCard
          label={t('dashboard.kpi_strip.weekly_pr')}
          value={format(weekPr.weight)}
          sub={weekPr.lift}
          accent
        />
      ) : (
        <KpiCard
          label={t('dashboard.kpi_strip.program_progress')}
          value={totalWorkouts > 0 ? `${completed}/${totalWorkouts}` : '—'}
          sub={t('dashboard.kpi_strip.program_workouts')}
          progress={
            totalWorkouts > 0
              ? {
                  value: completed / totalWorkouts,
                  label: t('dashboard.kpi_strip.program_progress_aria', {
                    completed,
                    total: totalWorkouts,
                  }),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
