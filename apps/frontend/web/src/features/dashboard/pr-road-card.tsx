import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/components/progress-bar';
import type { PrRoad } from './use-pr-road';

interface PrRoadCardProps {
  readonly road: PrRoad | null;
}

export function PrRoadCard({ road }: PrRoadCardProps): React.ReactNode {
  const { t } = useTranslation();

  if (!road) {
    return (
      <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5 opacity-70">
        <p className="chalk-stamp mb-2">{t('dashboard.pr_road.title')}</p>
        <p className="text-sm text-muted">{t('dashboard.pr_road.empty')}</p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">{t('dashboard.pr_road.title')}</p>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted">{t('dashboard.pr_road.lift')}</dt>
        <dd className="text-main font-bold">{road.lift}</dd>
        <dt className="text-muted">{t('dashboard.pr_road.current')}</dt>
        <dd className="text-main tabular-nums">{road.current} kg</dd>
        <dt className="text-muted">PR</dt>
        <dd className="text-victory tabular-nums">{road.target} kg</dd>
        <dt className="text-muted">{t('dashboard.pr_road.remaining')}</dt>
        <dd className="text-main tabular-nums">{road.deltaToPr} kg</dd>
      </dl>
      <div className="mt-3">
        <ProgressBar
          completed={Math.round(road.pctTowardPr)}
          total={100}
          ariaLabel={t('dashboard.pr_road.aria', { lift: road.lift })}
        />
      </div>
    </section>
  );
}
