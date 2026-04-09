import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms, fetchInsights } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { Link } from '@tanstack/react-router';
import { KpiSummary } from './kpi-summary';
import { ActiveProgramCard } from './active-program-card';
import { VolumeTrendCard } from '@/features/insights/volume-trend-card';
import { FrequencyCard } from '@/features/insights/frequency-card';
import { PlateauAlert } from '@/features/insights/plateau-alert';
import { LoadRecommendation } from '@/features/insights/load-recommendation';

const DASHBOARD_INSIGHT_TYPES = [
  'volume_trend',
  'frequency',
  'e1rm_progression',
  'plateau_detection',
  'load_recommendation',
] as const;

export function DashboardPage(): React.ReactNode {
  const { user } = useAuth();
  const { isGuest } = useGuest();

  useDocumentTitle('Dashboard — Gravity Room');

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

  const programs = programsQuery.data ?? [];
  const insights = insightsQuery.data ?? [];
  const activeProgram = programs.find((p) => p.status === 'active') ?? null;

  const volumeTrend = insights.find((i) => i.insightType === 'volume_trend') ?? null;
  const frequency = insights.find((i) => i.insightType === 'frequency') ?? null;
  const plateauInsights = insights.filter((i) => i.insightType === 'plateau_detection');
  const recommendationInsights = insights.filter((i) => i.insightType === 'load_recommendation');

  const hasPrograms = !isGuest && programs.length > 0;

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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

        {/* KPI row */}
        {hasPrograms && (
          <KpiSummary
            programs={programs}
            insights={insights}
            isLoadingInsights={insightsQuery.isLoading}
          />
        )}

        {programsQuery.isLoading && !isGuest && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-card border border-rule p-4 sm:p-5 animate-pulse">
                <div className="h-2.5 w-20 bg-rule rounded mb-3" />
                <div className="h-7 w-16 bg-rule rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Active program + performance analytics */}
        {activeProgram ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
            <div className="lg:col-span-3">
              <h2 className="dash-section-title mb-3">Programa Activo</h2>
              <ActiveProgramCard
                program={activeProgram}
                onOrphanDeleted={() => void programsQuery.refetch()}
              />
            </div>
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
                </div>
              )}
            </div>
          </div>
        ) : (
          !isGuest &&
          !programsQuery.isLoading && (
            <div className="bg-card border border-rule p-8 text-center mb-6">
              <img
                src="/empty-dashboard.webp"
                alt=""
                className="w-full max-w-sm mx-auto mb-5 opacity-80"
                loading="lazy"
              />
              <p className="text-sm text-muted mb-4">
                Elige un programa para ver tus métricas aquí.
              </p>
              <Link
                to="/app/programs"
                className="inline-block px-4 py-2 text-xs font-bold uppercase tracking-wide text-btn-active-text bg-btn-active border-2 border-btn-ring hover:opacity-90 transition-opacity"
              >
                Ver Programas
              </Link>
            </div>
          )
        )}

        {/* Plateau alerts */}
        {plateauInsights.length > 0 && (
          <section className="mb-6">
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
          <section className="mb-6">
            <h2 className="dash-section-title mb-3">Recomendación de Carga</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendationInsights.map((insight) => (
                <LoadRecommendation key={`rec-${insight.exerciseId}`} insight={insight} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
