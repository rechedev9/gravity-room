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

function MetaChip({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <span className="inline-flex items-center border border-rule bg-body/40 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
      {children}
    </span>
  );
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
      className="group mb-4 overflow-hidden border border-rule bg-card sm:mb-8"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-xs font-bold tracking-wide select-none sm:px-5 [&::marker]:hidden">
        <span className="font-display text-sm uppercase tracking-wide text-title">{title}</span>
        <span className="text-muted transition-transform duration-200 group-open:rotate-90">
          &#9656;
        </span>
      </summary>
      <div className="border-t border-rule-light px-4 pb-5 sm:px-5">
        <p className="mt-4 text-sm leading-7 text-info">{description}</p>
        {authorLine !== undefined && (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
            {authorLine}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <MetaChip>{t('catalog.meta.total_workouts', { count: totalWorkouts })}</MetaChip>
          <MetaChip>{t('catalog.meta.per_week', { count: workoutsPerWeek })}</MetaChip>
          <MetaChip>{t('catalog.meta.day_rotation', { count: dayCount })}</MetaChip>
        </div>
      </div>
    </details>
  );
}
