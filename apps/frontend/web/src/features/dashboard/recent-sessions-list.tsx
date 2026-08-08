import { useTranslation } from 'react-i18next';

interface SessionRow {
  readonly dateLabel: string;
  readonly dayIndex: number;
  readonly dayName: string;
  readonly exerciseNames: readonly string[];
  readonly successCount: number;
  readonly totalSets: number;
}

interface RecentSessionsListProps {
  readonly sessions: readonly SessionRow[];
}

export function RecentSessionsList({ sessions }: RecentSessionsListProps): React.ReactNode {
  const { t } = useTranslation();

  if (sessions.length === 0) {
    return (
      <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-6 text-center">
        <p className="chalk-stamp text-label">{t('dashboard.recent_sessions.title')}</p>
        <p className="text-main font-display text-2xl mt-3">
          {t('dashboard.recent_sessions.empty_title')}
        </p>
        <p className="text-muted text-sm mt-1">{t('dashboard.recent_sessions.empty_body')}</p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="chalk-stamp">{t('dashboard.recent_sessions.title')}</p>
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          {t('dashboard.recent_sessions.logged', { count: sessions.length })}
        </span>
      </div>
      <ul className="divide-y divide-rule">
        {sessions.map((s) => (
          <li key={s.dayIndex} className="flex items-center gap-3 py-3.5 text-sm">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ok-ring bg-ok-bg font-mono text-sm font-bold text-ok"
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-label">
                  {t('dashboard.recent_sessions.day_label', { day: s.dayIndex })}
                </span>
                {s.dateLabel && (
                  <span className="font-mono text-[11px] text-muted">{s.dateLabel}</span>
                )}
              </div>
              <p className="mt-1 truncate font-medium text-main">{s.dayName}</p>
              {s.exerciseNames.length > 0 && (
                <p className="mt-0.5 truncate text-xs text-muted">{s.exerciseNames.join(' + ')}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xs font-bold tabular-nums text-main">
                {s.successCount}/{s.totalSets}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">{t('dashboard.recent_sessions.sets')}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
