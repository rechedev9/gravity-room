import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { Link } from '@tanstack/react-router';
import { ActiveProgramBlock } from './active-program-block';
import { ProgramCatalog } from './program-catalog';
import { useDashboardData } from '@/features/dashboard/use-dashboard-data';
import { ScreenHeader } from '@/components/screen-header';
import { ZoneHint } from '@/features/home/zone-hint';

export function ProgramsPage(): React.ReactNode {
  const { t } = useTranslation();
  const { user } = useAuth();

  useDocumentTitle(t('programs.page_title'));
  const { isGuest } = useGuest();

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  const activeProgram = programsQuery.data?.find((p) => p.status === 'active') ?? null;

  // Live progress for the active program (completed workouts + total), sharing
  // the tracker/home query cache. Disabled internally when there is no active
  // program, so calling it unconditionally is safe.
  const dashboard = useDashboardData(activeProgram);

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ScreenHeader
          className="mb-3"
          eyebrow={t('navigation.tab_plans')}
          title={t('programs.title')}
          subtitle={t('programs.subtitle')}
        />
        <Link
          to="/app/start"
          data-testid="programs-guided-start"
          className="type-button mb-8 inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover:text-accent-hover"
        >
          {t('programs.guided_start_cta')}
        </Link>

        <ZoneHint zone="programs" className="mb-6" />

        {activeProgram && (
          <ActiveProgramBlock
            programId={activeProgram.programId}
            name={activeProgram.name}
            completed={dashboard.totalSessions}
            total={dashboard.totalWorkouts}
          />
        )}

        {/* Phones browse the catalog on the Explore tab; desktop keeps it on this page. */}
        <Link
          to="/app/explore"
          data-testid="programs-explore-link"
          className="lg:hidden flex min-h-11 items-center justify-between gap-3 bg-card border border-rule rounded-card px-4 py-3 hover:border-rule-light transition-colors"
        >
          <span className="type-button text-main">{t('programs.explore.link')}</span>
          <span aria-hidden="true" className="text-muted">
            &rarr;
          </span>
        </Link>

        <section className="hidden lg:block mb-10">
          <ProgramCatalog showHeading activeProgramId={activeProgram?.programId ?? null} />
        </section>
      </div>
    </div>
  );
}
