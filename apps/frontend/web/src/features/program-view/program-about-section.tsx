import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ProgramAboutSectionProps {
  readonly title: string;
  readonly description: string;
  readonly authorLine?: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly dayCount: number;
  readonly defaultOpen?: boolean;
}

export function ProgramAboutSection({
  title,
  description,
  authorLine,
  totalWorkouts,
  workoutsPerWeek,
  dayCount,
  defaultOpen = false,
}: ProgramAboutSectionProps): ReactNode {
  const { t } = useTranslation();
  return (
    <details
      open={defaultOpen}
      className="group bg-card border border-rule mb-4 sm:mb-8 overflow-hidden"
    >
      <summary className="px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-xs tracking-wide">
        {title}
        <span className="transition-transform duration-200 group-open:rotate-90">&#9656;</span>
      </summary>
      <div className="px-5 pb-5 border-t border-rule-light">
        <p className="mt-3 text-sm leading-7 text-info">{description}</p>
        {authorLine !== undefined && <p className="mt-2 text-xs text-muted">{authorLine}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
          <span>{t('catalog.meta.total_workouts', { count: totalWorkouts })}</span>
          <span>{t('catalog.meta.per_week', { count: workoutsPerWeek })}</span>
          <span>{t('catalog.meta.day_rotation', { count: dayCount })}</span>
        </div>
      </div>
    </details>
  );
}
