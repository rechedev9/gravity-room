import { useState, useMemo, useEffect } from 'react';
import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms, fetchCatalogList } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useTracker } from '@/contexts/tracker-context';
import { useDefinitions } from '@/hooks/use-definitions';
import { useNavigate } from '@tanstack/react-router';
import { ProgramCard } from './program-card';
import { MyDefinitionsPanel } from './my-definitions-panel';
import { DefinitionWizard } from './definition-wizard';
import { Button } from '@/components/button';
import { isOnboardingDismissed, dismissOnboarding } from '@/lib/onboarding';
import { PROGRAM_LEVELS } from '@gzclp/shared/catalog';
import type { ProgramLevel } from '@gzclp/shared/catalog';

const LEVEL_LABELS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export function ProgramsPage(): React.ReactNode {
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'Programas — Gravity Room';
    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, []);
  const { isGuest } = useGuest();
  const navigate = useNavigate();
  const { setTracker } = useTracker();
  const { forkAsync, isForking } = useDefinitions();
  const queryClient = useQueryClient();
  const [wizardDefinitionId, setWizardDefinitionId] = useState<string | null>(null);

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

  const handleCustomize = async (templateId: string): Promise<void> => {
    try {
      const forked = await forkAsync(templateId, 'template');
      setWizardDefinitionId(forked.id);
    } catch {
      /* Fork failed — error handled by mutation */
    }
  };

  const handleWizardComplete = (definitionId: string): void => {
    setWizardDefinitionId(null);
    void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.definitions.all });
    handleStartProgram(`custom:${definitionId}`);
  };

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl text-title tracking-wide">Programas</h1>
          <p className="text-xs text-muted mt-0.5">
            Catálogo de programas de entrenamiento por nivel
          </p>
        </header>

        {/* Catalog */}
        <section className="mb-10">
          <h2 className="dash-section-title mb-4">
            {activeProgram ? 'Otros Programas' : 'Elegir un Programa'}
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
              <p className="text-sm text-muted mb-3">No se pudo cargar el catálogo.</p>
              <Button onClick={() => void catalogQuery.refetch()}>Reintentar</Button>
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
                      {LEVEL_LABELS[level]}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {entries.map((entry) => (
                        <ProgramCard
                          key={entry.id}
                          definition={entry}
                          isActive={false}
                          onSelect={() => handleStartProgram(entry.id)}
                          onCustomize={
                            user && !isGuest ? () => void handleCustomize(entry.id) : undefined
                          }
                          customizeDisabled={isForking}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Custom definitions */}
        {user && !isGuest && (
          <section className="border-t border-rule pt-8">
            <h2 className="dash-section-title mb-4">Mis Programas Personalizados</h2>
            <MyDefinitionsPanel
              onOpenWizard={setWizardDefinitionId}
              onStartProgram={(defId) => {
                setWizardDefinitionId(defId);
              }}
            />
          </section>
        )}
      </div>

      {wizardDefinitionId !== null && (
        <DefinitionWizard
          definitionId={wizardDefinitionId}
          onComplete={handleWizardComplete}
          onCancel={() => setWizardDefinitionId(null)}
        />
      )}
    </div>
  );
}
