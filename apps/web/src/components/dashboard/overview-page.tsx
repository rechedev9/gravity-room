import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogList,
  fetchCatalogDetail,
  fetchInsights,
} from '@/lib/api-functions';
import type { InsightItem, ProgramSummary } from '@/lib/api-functions';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { computeProfileData, formatVolume } from '@/lib/profile-stats';
import { parseCustomDefinition } from '@/lib/program-utils';
import { isFrequencyPayload, isVolumeTrendPayload, isE1rmPayload } from '@/lib/insight-payloads';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useTracker } from '@/contexts/tracker-context';
import { useDefinitions } from '@/hooks/use-definitions';
import { KpiCard } from './kpi-card';
import { ActiveProgramCard } from './active-program-card';
import { VolumeTrendCard } from './volume-trend-card';
import { FrequencyCard } from './frequency-card';
import { PlateauAlert } from './plateau-alert';
import { LoadRecommendation } from './load-recommendation';
import { ProgramCard } from '@/components/program-card';
import { GuestBanner } from '@/components/guest-banner';
import { OnboardingBanner } from '@/components/onboarding-banner';
import { DefinitionWizard } from '@/components/definition-wizard';
import { MyDefinitionsPanel } from '@/components/my-definitions-panel';
import { Button } from '@/components/button';
import { isOnboardingDismissed, dismissOnboarding } from '@/lib/onboarding';
import { PROGRAM_LEVELS } from '@gzclp/shared/catalog';
import type { ProgramLevel } from '@gzclp/shared/catalog';

const LEVEL_LABELS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

const DASHBOARD_INSIGHT_TYPES = [
  'volume_trend',
  'frequency',
  'e1rm_progression',
  'plateau_detection',
  'load_recommendation',
] as const;

interface KpiSummaryProps {
  readonly programs: readonly ProgramSummary[];
  readonly insights: readonly InsightItem[];
  readonly isLoadingInsights: boolean;
}

function KpiSummary({ programs, insights, isLoadingInsights }: KpiSummaryProps): React.ReactNode {
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

  // Extract insight data
  const frequency = insights.find((i) => i.insightType === 'frequency');
  const freqPayload = frequency && isFrequencyPayload(frequency.payload) ? frequency.payload : null;

  const volumeTrend = insights.find((i) => i.insightType === 'volume_trend');
  const volPayload =
    volumeTrend && isVolumeTrendPayload(volumeTrend.payload) ? volumeTrend.payload : null;

  const lastVolume = volPayload?.volumes[volPayload.volumes.length - 1] ?? null;

  const e1rmInsights = insights.filter((i) => i.insightType === 'e1rm_progression');
  const best1rm = e1rmInsights.reduce<{ value: number; exercise: string }>(
    (best, i) => {
      const p = i.payload;
      if (isE1rmPayload(p) && p.currentMax > best.value) {
        return { value: p.currentMax, exercise: i.exerciseId ?? '' };
      }
      return best;
    },
    { value: 0, exercise: '' }
  );

  const activePct = profileData?.completion.completionPct ?? null;
  const loadingKpi = isLoading || isLoadingInsights;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      <KpiCard
        label="Sesiones/sem"
        value={freqPayload?.sessionsPerWeek ?? '—'}
        sub="frecuencia"
        loading={loadingKpi}
      />
      <KpiCard
        label="Racha"
        value={freqPayload?.currentStreak ?? profileData?.streak.current ?? 0}
        sub="seguidos"
        accent
        loading={loadingKpi}
      />
      <KpiCard
        label="Programa"
        value={activePct !== null ? `${activePct}%` : '—'}
        sub="completado"
        loading={loadingKpi}
      />
      <KpiCard
        label="Volumen/sem"
        value={lastVolume !== null ? formatVolume(lastVolume) : '—'}
        sub="kg"
        trend={volPayload?.direction ?? null}
        trendLabel={
          volPayload?.direction === 'up'
            ? 'subiendo'
            : volPayload?.direction === 'down'
              ? 'bajando'
              : volPayload?.direction === 'flat'
                ? 'estable'
                : undefined
        }
        loading={loadingKpi}
      />
      <KpiCard
        label="Consistencia"
        value={freqPayload ? `${freqPayload.consistencyPct}%` : '—'}
        sub={freqPayload ? `${freqPayload.totalSessions} total` : undefined}
        loading={loadingKpi}
      />
      <KpiCard
        label="Mejor 1RM"
        value={best1rm.value > 0 ? `${best1rm.value}` : '—'}
        sub={best1rm.value > 0 ? `kg · ${best1rm.exercise}` : 'kg'}
        loading={loadingKpi}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview page — GA-style data-rich dashboard
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

  const insightsQuery = useQuery({
    queryKey: queryKeys.insights.list([...DASHBOARD_INSIGHT_TYPES]),
    queryFn: () => fetchInsights([...DASHBOARD_INSIGHT_TYPES]),
    enabled: user !== null && !isGuest,
    staleTime: 10 * 60 * 1000,
  });

  const activeProgram = (() => {
    if (isGuest) return null;
    if (!programsQuery.data) return null;
    return programsQuery.data.find((p) => p.status === 'active') ?? null;
  })();

  // Extract insights for inline display
  const insights = insightsQuery.data ?? [];
  const volumeTrend = insights.find((i) => i.insightType === 'volume_trend') ?? null;
  const frequency = insights.find((i) => i.insightType === 'frequency') ?? null;
  const plateauInsights = insights.filter((i) => i.insightType === 'plateau_detection');
  const recommendationInsights = insights.filter((i) => i.insightType === 'load_recommendation');

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

  const hasPrograms = !isGuest && programsQuery.data && programsQuery.data.length > 0;

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Dashboard header */}
        <header className="flex items-end justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-title tracking-wide">
              Dashboard
            </h1>
            <p className="text-xs text-muted mt-0.5">Rendimiento y progreso de entrenamiento</p>
          </div>
          {insightsQuery.data && insightsQuery.data.length > 0 && (
            <p className="font-mono text-[10px] text-muted hidden sm:block">
              Datos actualizados cada 6h
            </p>
          )}
        </header>

        {isGuest && <GuestBanner className="mb-6" />}

        {onboardingVisible && !activeProgram && !programsQuery.isLoading && (
          <OnboardingBanner
            onDismiss={() => {
              dismissOnboarding();
              setOnboardingVisible(false);
            }}
          />
        )}

        {/* KPI row — 6 metrics across */}
        {hasPrograms && (
          <KpiSummary
            programs={programsQuery.data}
            insights={insights}
            isLoadingInsights={insightsQuery.isLoading}
          />
        )}

        {/* Loading skeleton */}
        {!isGuest && programsQuery.isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-card border border-rule p-4 sm:p-5 animate-pulse">
                <div className="h-2.5 w-20 bg-rule rounded mb-3" />
                <div className="h-7 w-16 bg-rule rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Main content: program card + analytics side panel */}
        {activeProgram && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
            {/* Left: Active program */}
            <div className="lg:col-span-3">
              <h2 className="dash-section-title mb-3">Programa Activo</h2>
              <ActiveProgramCard
                program={activeProgram}
                onOrphanDeleted={() => void programsQuery.refetch()}
              />
            </div>

            {/* Right: Key analytics */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="dash-section-title mb-3">Rendimiento</h2>
              {volumeTrend && <VolumeTrendCard insight={volumeTrend} />}
              {frequency && <FrequencyCard insight={frequency} />}
              {!volumeTrend && !frequency && !insightsQuery.isLoading && (
                <div className="bg-card border border-rule p-6 text-center">
                  <p className="text-xs text-muted">
                    Completa entrenamientos para ver tus analíticas aquí.
                  </p>
                </div>
              )}
              {insightsQuery.isLoading && (
                <div className="space-y-4">
                  <div className="bg-card border border-rule p-5 animate-pulse">
                    <div className="h-3 w-32 bg-rule rounded mb-4" />
                    <div className="h-36 bg-rule rounded" />
                  </div>
                  <div className="bg-card border border-rule p-5 animate-pulse">
                    <div className="h-3 w-24 bg-rule rounded mb-4" />
                    <div className="h-16 bg-rule rounded" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plateau alerts */}
        {plateauInsights.length > 0 && (
          <section className="mb-8">
            <h2 className="dash-section-title mb-3">Alertas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plateauInsights.map((insight) => (
                <PlateauAlert key={`plateau-${insight.exerciseId}`} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Load recommendations */}
        {recommendationInsights.length > 0 && (
          <section className="mb-8">
            <h2 className="dash-section-title mb-3">Recomendación de Carga</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendationInsights.map((insight) => (
                <LoadRecommendation key={`rec-${insight.exerciseId}`} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Program catalog */}
        <section className="mb-8">
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
          <section className="mt-12">
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
