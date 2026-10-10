import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PROGRAM_LEVELS } from '@gzclp/domain/catalog';
import type { ProgramLevel } from '@gzclp/domain/catalog';
import { queryKeys } from '@/lib/query-keys';
import { fetchCatalogList } from '@/lib/api-functions';
import { useTracker } from '@/contexts/tracker-context';
import { Button } from '@/components/button';
import { StaggerContainer, StaggerItem, fadeUpFastVariants } from '@/lib/motion-primitives';
import { ProgramCard } from './program-card';

const LEVEL_LABEL_KEYS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'programs.card.level_beginner',
  intermediate: 'programs.card.level_intermediate',
  advanced: 'programs.card.level_advanced',
};

interface ProgramCatalogProps {
  /** Catalog id of the active program; it is listed in its own block, not here. */
  readonly activeProgramId: string | null;
}

/** The program catalog grouped by level. Shared by /app/programs (desktop) and /app/explore. */
export function ProgramCatalog({ activeProgramId }: ProgramCatalogProps): React.ReactNode {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setTracker } = useTracker();

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: fetchCatalogList,
    staleTime: 5 * 60 * 1000,
  });

  const catalogGrouped = useMemo(() => {
    if (!catalogQuery.data) return null;
    const filtered = catalogQuery.data.filter((e) => e.id !== activeProgramId);
    if (filtered.length === 0) return null;
    const grouped = new Map<ProgramLevel, typeof filtered>();
    for (const entry of filtered) {
      const list = grouped.get(entry.level) ?? [];
      list.push(entry);
      grouped.set(entry.level, list);
    }
    return grouped;
  }, [catalogQuery.data, activeProgramId]);

  const handleStartProgram = (programId: string): void => {
    setTracker(programId, undefined);
    void navigate({ to: '/app/tracker/$programId', params: { programId } });
  };

  return (
    <>
      {catalogQuery.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-card rounded-card border border-rule p-5 animate-pulse">
              <div className="h-4 w-32 bg-rule rounded mb-2" />
              <div className="h-3 w-48 bg-rule rounded mb-4" />
              <div className="h-10 w-36 bg-rule rounded" />
            </div>
          ))}
        </div>
      )}

      {catalogQuery.isError && (
        <div className="bg-card rounded-card border border-rule p-6 text-center">
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
                <h3 className="flex items-center gap-2.5 font-mono text-[10px] font-semibold text-label uppercase tracking-[0.08em] mb-4">
                  <span className="inline-block w-1.5 h-1.5 rounded-[1px] bg-accent" />
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
                        previewTo={`/programs/${entry.id}`}
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
    </>
  );
}
