import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useDashboardData } from '@/features/dashboard/use-dashboard-data';
import { fetchPrograms } from '@/lib/api-functions';
import { localizedProgramName } from '@/lib/catalog-display';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';

interface DesktopProgramCardProps {
  /** The card only loads data for a signed-in user; guests render nothing. */
  readonly enabled: boolean;
}

/**
 * Sidebar card for the active program: name, "Semana N", "Día N de M" and a
 * progress bar. It shares the programs list and program detail cache keys with
 * Home and the tracker, so it adds no requests once either has loaded. Renders
 * nothing without an active program or while its data is still unknown.
 */
export function DesktopProgramCard({ enabled }: DesktopProgramCardProps): React.ReactNode {
  const { t } = useTranslation();
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled,
  });
  const activeProgram = enabled
    ? (programsQuery.data?.find((p) => p.status === 'active') ?? null)
    : null;
  const { programProgress } = useDashboardData(activeProgram);

  if (!activeProgram || !programProgress) return null;

  const name = activeProgram.programId.startsWith('custom:')
    ? activeProgram.name
    : localizedProgramName(t, activeProgram.programId, activeProgram.name);
  const percent = Math.round(programProgress.fraction * 1000) / 10;

  return (
    <Link
      to="/app/tracker"
      aria-label={`${t('desktop_shell.program_card.label')}: ${name}`}
      className={cn(
        'block rounded-card border border-rule bg-card p-3 transition-colors hover:border-rule-light',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]'
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-bold text-main">{name}</span>
        <span className="shrink-0 font-mono text-[11px] text-accent">
          {t('desktop_shell.program_card.week', { week: programProgress.week })}
        </span>
      </span>
      <span className="mt-0.5 block font-mono text-[11px] text-muted">
        {t('desktop_shell.program_card.day', {
          day: programProgress.day,
          total: programProgress.totalDays,
        })}
      </span>
      {/* Decorative: the "Día N de M" text above already states the same value,
          and the tracker keeps the page's single progressbar. */}
      <span
        aria-hidden="true"
        className="mt-2 block h-1 overflow-hidden rounded-[3px] bg-[var(--color-surface-2)]"
      >
        <span className="block h-full bg-accent" style={{ width: `${percent}%` }} />
      </span>
    </Link>
  );
}
