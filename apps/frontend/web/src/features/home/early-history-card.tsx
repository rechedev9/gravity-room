import { useTranslation } from 'react-i18next';
import { HOME_HEATMAP_MIN_SESSIONS, HOME_SPLIT_MIN_SESSIONS } from './home-dashboard-layout';

interface EarlyHistoryCardProps {
  readonly completedSessions: number;
}

export function EarlyHistoryCard({ completedSessions }: EarlyHistoryCardProps): React.ReactNode {
  const { t } = useTranslation();
  const completed = Math.max(0, completedSessions);
  const nextTarget = HOME_SPLIT_MIN_SESSIONS;
  const progress = Math.min(1, completed / nextTarget);

  return (
    <section className="overflow-hidden rounded-[var(--radius-base)] border border-rule bg-card shadow-[var(--shadow-card)]">
      <div className="grid sm:grid-cols-[minmax(0,1.15fr)_minmax(250px,0.85fr)]">
        <div className="p-5 sm:p-6">
          <p className="chalk-stamp text-accent">{t('home.early_history.kicker')}</p>
          <h2 className="mt-2 font-display text-3xl text-main sm:text-4xl">
            {t('home.early_history.title')}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            {t('home.early_history.body')}
          </p>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.06em]">
              <span className="text-label">{t('home.early_history.next_milestone')}</span>
              <span className="tabular-nums text-main">
                {t('home.early_history.progress', { completed, target: nextTarget })}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-progress-track"
              role="progressbar"
              aria-label={t('home.early_history.progress_aria')}
              aria-valuemin={0}
              aria-valuemax={nextTarget}
              aria-valuenow={Math.min(completed, nextTarget)}
            >
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-rule bg-surface-2/50 p-5 sm:border-l sm:border-t-0 sm:p-6">
          <p className="chalk-stamp mb-4">{t('home.early_history.coming_next')}</p>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent bg-accent-dim font-mono text-[11px] font-bold text-accent">
                {HOME_SPLIT_MIN_SESSIONS}
              </span>
              <div>
                <p className="text-sm font-medium text-main">{t('home.early_history.pr_title')}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {t('home.early_history.pr_body')}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rule-light bg-card font-mono text-[11px] font-bold text-label">
                {HOME_HEATMAP_MIN_SESSIONS}
              </span>
              <div>
                <p className="text-sm font-medium text-main">
                  {t('home.early_history.heatmap_title')}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {t('home.early_history.heatmap_body')}
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
