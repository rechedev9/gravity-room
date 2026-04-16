import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms, fetchCatalogList } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useTracker } from '@/contexts/tracker-context';
import { useNavigate } from '@tanstack/react-router';
import { ProgramCard } from './program-card';
import { Button } from '@/components/button';
import { isOnboardingDismissed, dismissOnboarding } from '@/lib/onboarding';
import { PROGRAM_LEVELS } from '@gzclp/shared/catalog';
import type { ProgramLevel } from '@gzclp/shared/catalog';
import { StaggerContainer, StaggerItem, fadeUpFastVariants } from '@/lib/motion-primitives';

const LEVEL_LABEL_KEYS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'programs.card.level_beginner',
  intermediate: 'programs.card.level_intermediate',
  advanced: 'programs.card.level_advanced',
};

export function ProgramsPage(): React.ReactNode {
  const { t } = useTranslation();
  const { user } = useAuth();

  useDocumentTitle(t('programs.page_title'));
  const { isGuest } = useGuest();
  const navigate = useNavigate();
  const { setTracker } = useTracker();

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: 5 * 60 * 1000,
  });

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  const activeProgram = programsQuery.data?.find((p) => p.status === 'active') ?? null;

  const catalogGrouped = useMemo(() => {
    if (!catalogQuery.data) return null;
    const filtered = catalogQuery.data.filter((e) => e.id !== activeProgram?.programId);
    if (filtered.length === 0) return null;
    const grouped = new Map<ProgramLevel, typeof filtered>();
    for (const entry of filtered) {
      const list = grouped.get(entry.level) ?? [];
      list.push(entry);
      grouped.set(entry.level, list);
    }
    return grouped;
  }, [catalogQuery.data, activeProgram?.programId]);

  const handleStartProgram = (programId: string): void => {
    if (!isOnboardingDismissed()) dismissOnboarding();
    setTracker(programId, undefined);
    void navigate({ to: '/app/tracker/$programId', params: { programId } });
  };

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl text-title tracking-wide">
            {t('programs.title')}
          </h1>
          <p className="text-xs text-muted mt-0.5">{t('programs.subtitle')}</p>
        </header>

        {/* Catalog */}
        <section className="mb-10">
          <h2 className="dash-section-title mb-4">
            {activeProgram ? t('programs.other_programs') : t('programs.choose_program')}
          </h2>

          {catalogQuery.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-card border border-rule p-5 animate-pulse">
                  <div className="h-4 w-32 bg-rule rounded mb-2" />
                  <div className="h-3 w-48 bg-rule rounded mb-4" />
                  <div className="h-10 w-36 bg-rule rounded" />
                </div>
              ))}
            </div>
          )}

          {catalogQuery.isError && (
            <div className="bg-card border border-rule p-6 text-center">
              <p className="text-sm text-muted mb-3">{t('programs.catalog_load_error')}</p>
              <Button onClick={() => void catalogQuery.refetch()}>{t('programs.retry')}</Button>
            </div>
          )}

          {catalogGrouped && (
            <div className="space-y-8">
              {PROGRAM_LEVELS.map((level) => {
                const entries = catalogGrouped.get(level);
                if (!entries?.length) return null;
                return (
                  <div key={level}>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-label uppercase tracking-wide mb-4">
                      <span className="inline-block w-2 h-2 rounded-full bg-accent" />
                      {t(LEVEL_LABEL_KEYS[level])}
                    </h3>
                    <StaggerContainer
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                      stagger={0.05}
                    >
                      {entries.map((entry) => (
                        <StaggerItem key={entry.id} variants={fadeUpFastVariants}>
                          <ProgramCard
                            definition={entry}
                            isActive={false}
                            onSelect={() => handleStartProgram(entry.id)}
                          />
                        </StaggerItem>
                      ))}
                    </StaggerContainer>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
