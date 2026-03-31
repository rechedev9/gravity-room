import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogList,
  fetchCatalogDetail,
  deleteProgram,
} from '@/lib/api-functions';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import { isRecord } from '@gzclp/shared/type-guards';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { computeProfileData, formatVolume } from '@/lib/profile-stats';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useTracker } from '@/contexts/tracker-context';
import { useDefinitions } from '@/hooks/use-definitions';
import { KpiCard } from './kpi-card';
import { RecentActivity } from './recent-activity';
import { ProgramCard } from '@/components/program-card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { GuestBanner } from '@/components/guest-banner';
import { OnboardingBanner } from '@/components/onboarding-banner';
import { DefinitionWizard } from '@/components/definition-wizard';
import { MyDefinitionsPanel } from '@/components/my-definitions-panel';
import { Button } from '@/components/button';
import { isOnboardingDismissed, dismissOnboarding } from '@/lib/onboarding';
import { PROGRAM_LEVELS } from '@gzclp/shared/catalog';
import type { ProgramLevel } from '@gzclp/shared/catalog';
import type { ProgramSummary } from '@/lib/api-functions';

const LEVEL_LABELS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

function parseCustomDefinition(raw: unknown): ProgramDefinition | undefined {
  if (!isRecord(raw)) return undefined;
  const result = ProgramDefinitionSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

// ---------------------------------------------------------------------------
// Active program card with progress
// ---------------------------------------------------------------------------

interface ActiveProgramCardProps {
  readonly program: ProgramSummary;
  readonly onOrphanDeleted?: () => void;
}

function ActiveProgramCard({ program, onOrphanDeleted }: ActiveProgramCardProps): React.ReactNode {
  const navigate = useNavigate();
  const { setTracker } = useTracker();
  const queryClient = useQueryClient();
  const [showOrphanConfirm, setShowOrphanConfirm] = useState(false);
  const isCustomProgram = program.programId.startsWith('custom:');

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(program.programId),
    queryFn: () => fetchCatalogDetail(program.programId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !isCustomProgram,
  });

  const deleteOrphanMutation = useMutation({
    mutationFn: () => deleteProgram(program.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      onOrphanDeleted?.();
    },
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(program.id),
    queryFn: () => fetchGenericProgramDetail(program.id),
  });

  const definition: ProgramDefinition | undefined = isCustomProgram
    ? parseCustomDefinition(detailQuery.data?.customDefinition)
    : catalogQuery.data;

  const rows = useMemo(() => {
    if (!detailQuery.data || !definition) return [];
    return computeGenericProgram(
      definition,
      detailQuery.data.config ?? {},
      detailQuery.data.results ?? {}
    );
  }, [detailQuery.data, definition]);

  const completedWorkouts = useMemo(() => {
    if (!detailQuery.data || !definition) return 0;
    const results = detailQuery.data.results;
    let count = 0;
    for (let i = 0; i < definition.totalWorkouts; i++) {
      const dayIndex = i % definition.cycleLength;
      const day = definition.days[dayIndex];
      const workoutResult = results[String(i)];
      if (!workoutResult) continue;
      const allDone = day.slots.every((slot) => workoutResult[slot.id]?.result !== undefined);
      if (allDone) count++;
    }
    return count;
  }, [detailQuery.data, definition]);

  const profileData = useMemo(() => {
    if (!definition || rows.length === 0) return null;
    return computeProfileData(
      rows,
      definition,
      detailQuery.data?.config ?? {},
      detailQuery.data?.resultTimestamps ?? {}
    );
  }, [definition, rows, detailQuery.data]);

  const totalWorkouts = definition?.totalWorkouts ?? 0;
  const progressPct = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

  const handleContinue = (): void => {
    setTracker(program.programId, program.id);
    navigate(`/app/tracker/${program.programId}`);
  };

  if (!definition) {
    const isOrphan = isCustomProgram ? detailQuery.isFetched && !definition : catalogQuery.isError;
    if (isOrphan) {
      return (
        <>
          <div className="bg-card border border-rule p-6">
            <h3 className="text-base font-extrabold text-title mb-2">Programa no disponible</h3>
            <p className="text-xs text-muted mb-5">
              La definición de este programa ya no existe. Elimina esta instancia para iniciar uno
              nuevo.
            </p>
            <Button
              onClick={() => setShowOrphanConfirm(true)}
              disabled={deleteOrphanMutation.isPending}
            >
              {deleteOrphanMutation.isPending ? 'Eliminando…' : 'Eliminar programa'}
            </Button>
          </div>
          <ConfirmDialog
            open={showOrphanConfirm}
            title="Eliminar programa huérfano"
            message="Se eliminarán todos los resultados asociados. ¿Continuar?"
            confirmLabel="Eliminar"
            cancelLabel="Cancelar"
            onConfirm={() => {
              setShowOrphanConfirm(false);
              deleteOrphanMutation.mutate();
            }}
            onCancel={() => setShowOrphanConfirm(false)}
          />
        </>
      );
    }
    return (
      <div className="bg-card border border-rule p-6 animate-pulse">
        <div className="h-5 w-48 bg-rule rounded mb-3" />
        <div className="h-2 bg-progress-track rounded mb-4" />
        <div className="h-10 w-48 bg-rule rounded" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-rule card overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 accent-left-gold">
        <h3 className="text-base font-extrabold text-title leading-tight mb-1">
          {definition.name}
        </h3>
        <p className="text-xs text-muted">{definition.description.split('.')[0]}.</p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-info mt-2 mb-3">
          <span>{totalWorkouts} entrenamientos</span>
          {definition.workoutsPerWeek > 0 && <span>{definition.workoutsPerWeek}x / semana</span>}
        </div>

        <div
          className="flex items-center gap-3 mb-4"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="flex-1 h-2.5 bg-progress-track overflow-hidden rounded-full">
            <div
              className="h-full bg-accent transition-[width] duration-300 ease-out progress-fill rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-xs font-bold text-muted whitespace-nowrap tabular-nums">
            {completedWorkouts}/{totalWorkouts}
          </span>
        </div>

        <Button variant="primary" onClick={handleContinue}>
          Continuar Entrenamiento
        </Button>
      </div>

      {/* KPI mini row */}
      {profileData && (
        <div className="grid grid-cols-3 divide-x divide-rule border-t border-rule">
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">Racha</p>
            <p className="font-display-data text-xl text-title">{profileData.streak.current}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">Éxito</p>
            <p className="font-display-data text-xl text-main">
              {profileData.completion.overallSuccessRate}%
            </p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
              Volumen
            </p>
            <p className="font-display-data text-xl text-main">
              {formatVolume(profileData.volume.totalVolume)} kg
            </p>
          </div>
        </div>
      )}

      {/* Recent activity */}
      {definition && rows.length > 0 && detailQuery.data && (
        <div className="px-5 py-4 border-t border-rule">
          <h4 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
            Actividad Reciente
          </h4>
          <RecentActivity
            rows={rows}
            definition={definition}
            resultTimestamps={detailQuery.data.resultTimestamps ?? {}}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI summary row (derived from all programs aggregate)
// ---------------------------------------------------------------------------

interface KpiSummaryProps {
  readonly programs: readonly ProgramSummary[];
}

function KpiSummary({ programs }: KpiSummaryProps): React.ReactNode {
  const totalCompleted = programs.reduce((sum, p) => {
    // Rough count: use programs with status completed
    return p.status === 'completed' ? sum + 1 : sum;
  }, 0);

  const active = programs.find((p) => p.status === 'active');

  const activeId = active?.id ?? '';
  const activeProgramId = active?.programId ?? '';

  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(activeId),
    queryFn: () => fetchGenericProgramDetail(activeId),
    enabled: active !== undefined,
  });

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(activeProgramId),
    queryFn: () => fetchCatalogDetail(activeProgramId),
    staleTime: 5 * 60 * 1000,
    enabled: active !== undefined && !activeProgramId.startsWith('custom:'),
  });

  const definition: ProgramDefinition | undefined = active?.programId.startsWith('custom:')
    ? parseCustomDefinition(detailQuery.data?.customDefinition)
    : catalogQuery.data;

  const profileData = useMemo(() => {
    if (!definition || !detailQuery.data) return null;
    const rows = computeGenericProgram(
      definition,
      detailQuery.data.config ?? {},
      detailQuery.data.results ?? {}
    );
    return computeProfileData(
      rows,
      definition,
      detailQuery.data.config ?? {},
      detailQuery.data.resultTimestamps ?? {}
    );
  }, [definition, detailQuery.data]);

  const isLoading = active !== undefined && (detailQuery.isLoading || catalogQuery.isLoading);

  const activePct = (() => {
    if (!profileData) return null;
    return profileData.completion.completionPct;
  })();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <KpiCard
        label="Completados"
        value={totalCompleted + (profileData?.completion.workoutsCompleted ?? 0)}
        sub="entrenamientos"
        loading={isLoading}
      />
      <KpiCard
        label="Racha Actual"
        value={profileData?.streak.current ?? 0}
        sub="seguidos"
        accent
        loading={isLoading}
      />
      <KpiCard
        label="Programa Activo"
        value={activePct !== null ? `${activePct}%` : '—'}
        sub="completado"
        loading={isLoading}
      />
      <KpiCard
        label="Volumen Total"
        value={profileData ? formatVolume(profileData.volume.totalVolume) : '—'}
        sub="kg"
        loading={isLoading}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview page
// ---------------------------------------------------------------------------

export function OverviewPage(): React.ReactNode {
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const navigate = useNavigate();
  const { setTracker } = useTracker();
  const [wizardDefinitionId, setWizardDefinitionId] = useState<string | null>(null);
  const [onboardingVisible, setOnboardingVisible] = useState(() => !isOnboardingDismissed());
  const { forkAsync, isForking } = useDefinitions();
  const queryClient = useQueryClient();

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

  const activeProgram = (() => {
    if (isGuest) return null;
    if (!programsQuery.data) return null;
    return programsQuery.data.find((p) => p.status === 'active') ?? null;
  })();

  const handleStartProgram = (programId: string): void => {
    if (onboardingVisible) {
      dismissOnboarding();
      setOnboardingVisible(false);
    }
    setTracker(programId, undefined);
    navigate(`/app/tracker/${programId}`);
  };

  const handleCustomize = async (templateId: string): Promise<void> => {
    try {
      const forked = await forkAsync(templateId, 'template');
      setWizardDefinitionId(forked.id);
    } catch {
      // Fork failed — error handled by mutation
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
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {isGuest && <GuestBanner className="mb-6" />}

        {onboardingVisible && !activeProgram && !programsQuery.isLoading && (
          <OnboardingBanner
            onDismiss={() => {
              dismissOnboarding();
              setOnboardingVisible(false);
            }}
          />
        )}

        {/* KPI cards — only shown for authenticated users with programs */}
        {!isGuest &&
          !programsQuery.isLoading &&
          programsQuery.data &&
          programsQuery.data.length > 0 && <KpiSummary programs={programsQuery.data} />}

        {/* Active program */}
        {!isGuest && programsQuery.isLoading && (
          <section className="mb-10">
            <div className="h-2.5 w-20 bg-rule rounded mb-4 animate-pulse" />
            <div className="bg-card border border-rule p-6 animate-pulse">
              <div className="h-5 w-48 bg-rule rounded mb-3" />
              <div className="h-2 bg-progress-track rounded mb-4" />
              <div className="h-10 w-48 bg-rule rounded" />
            </div>
          </section>
        )}

        {activeProgram && (
          <section className="mb-10">
            <h2 className="section-label mb-4">Tu Programa</h2>
            <ActiveProgramCard
              program={activeProgram}
              onOrphanDeleted={() => void programsQuery.refetch()}
            />
          </section>
        )}

        {/* Program catalog */}
        <section>
          <h2 className="section-label mb-4">
            {activeProgram ? 'Otros Programas' : 'Elegir un Programa'}
          </h2>

          {catalogQuery.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {catalogQuery.data &&
            (() => {
              const filtered = catalogQuery.data.filter((e) => e.id !== activeProgram?.programId);
              if (filtered.length === 0) return null;

              const grouped = new Map<ProgramLevel, typeof filtered>();
              for (const entry of filtered) {
                const list = grouped.get(entry.level) ?? [];
                list.push(entry);
                grouped.set(entry.level, list);
              }

              return (
                <div className="space-y-8">
                  {PROGRAM_LEVELS.map((level) => {
                    const entries = grouped.get(level);
                    if (!entries?.length) return null;
                    return (
                      <div key={level}>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-label uppercase tracking-wide mb-4">
                          <span className="inline-block w-2 h-2 rounded-full bg-accent" />
                          {LEVEL_LABELS[level]}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              );
            })()}
        </section>

        {/* Custom definitions */}
        {user && !isGuest && (
          <section className="mt-12">
            <h2 className="section-label mb-4">Mis Programas Personalizados</h2>
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
