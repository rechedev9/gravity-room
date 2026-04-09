import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { queryKeys } from '@/lib/query-keys';
import { fetchInsights } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { GuestBanner } from '@/components/guest-banner';
import { VolumeTrendCard } from '@/features/insights/volume-trend-card';
import { FrequencyCard } from '@/features/insights/frequency-card';
import { E1rmChart } from '@/features/insights/e1rm-chart';
import { PlateauAlert } from '@/features/insights/plateau-alert';
import { ForecastChart } from '@/features/insights/forecast-chart';
import { LoadRecommendation } from '@/features/insights/load-recommendation';
import { ExerciseSummaryCard } from '@/features/insights/exercise-summary-card';

const INSIGHT_TYPES = [
  'volume_trend',
  'frequency',
  'e1rm_progression',
  'plateau_detection',
  'e1rm_forecast',
  'load_recommendation',
  'exercise_summary',
] as const;

export function AnalyticsPage(): React.ReactNode {
  const { user } = useAuth();
  const { isGuest } = useGuest();

  useDocumentTitle('Analíticas — Gravity Room');

  const insightsQuery = useQuery({
    queryKey: queryKeys.insights.list([...INSIGHT_TYPES]),
    queryFn: () => fetchInsights([...INSIGHT_TYPES]),
    enabled: user !== null && !isGuest,
    staleTime: 10 * 60 * 1000,
  });

  const volumeTrend = insightsQuery.data?.find((i) => i.insightType === 'volume_trend');
  const frequency = insightsQuery.data?.find((i) => i.insightType === 'frequency');
  const e1rmInsights =
    insightsQuery.data?.filter((i) => i.insightType === 'e1rm_progression') ?? [];
  const plateauInsights =
    insightsQuery.data?.filter((i) => i.insightType === 'plateau_detection') ?? [];
  const forecastInsights =
    insightsQuery.data?.filter((i) => i.insightType === 'e1rm_forecast') ?? [];
  const recommendationInsights =
    insightsQuery.data?.filter((i) => i.insightType === 'load_recommendation') ?? [];
  const exerciseSummaryInsights =
    insightsQuery.data?.filter((i) => i.insightType === 'exercise_summary') ?? [];

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <header className="flex items-end justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-title tracking-wide">
              Analíticas
            </h1>
            <p className="text-xs text-muted mt-0.5">Rendimiento pre-calculado cada 6 horas</p>
          </div>
          {insightsQuery.dataUpdatedAt > 0 && (
            <p className="font-mono text-[10px] text-muted hidden sm:block">
              {new Date(insightsQuery.dataUpdatedAt).toLocaleString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'short',
              })}
            </p>
          )}
        </header>

        {isGuest && <GuestBanner className="mb-6" />}

        {/* Loading state */}
        {!isGuest && insightsQuery.isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-card border border-rule p-5 animate-pulse">
                <div className="h-3 w-32 bg-rule rounded mb-4" />
                <div className="h-36 bg-rule rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!isGuest && insightsQuery.isError && (
          <div className="bg-card border border-rule p-6 text-center">
            <p className="text-sm text-muted">No se pudieron cargar las analíticas.</p>
          </div>
        )}

        {/* Empty state */}
        {!isGuest && insightsQuery.isSuccess && !insightsQuery.data?.length && (
          <div className="bg-card border border-rule p-8 text-center max-w-lg mx-auto">
            <img
              src="/empty-analytics.webp"
              alt=""
              className="w-full max-w-sm mx-auto mb-5 opacity-80"
              loading="lazy"
            />
            <p className="text-sm text-muted">
              Sin datos todavía. Completa algunos entrenamientos para ver tus analíticas.
            </p>
          </div>
        )}

        {/* Dashboard content */}
        {!isGuest &&
          insightsQuery.isSuccess &&
          insightsQuery.data &&
          insightsQuery.data.length > 0 && (
            <div className="space-y-8">
              {/* Overview row: frequency + volume side by side */}
              {(frequency || volumeTrend) && (
                <section>
                  <h2 className="dash-section-title mb-3">Resumen</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {frequency && <FrequencyCard insight={frequency} />}
                    {volumeTrend && <VolumeTrendCard insight={volumeTrend} />}
                  </div>
                </section>
              )}

              {/* Exercise summary — compact grid per slot */}
              {exerciseSummaryInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">Resumen por Ejercicio</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {exerciseSummaryInsights.map((insight) => (
                      <ExerciseSummaryCard
                        key={`summary-${insight.exerciseId}`}
                        insight={insight}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Plateau alerts — full width banner-style */}
              {plateauInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">Alertas de Plateau</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {plateauInsights.map((insight) => (
                      <PlateauAlert key={`plateau-${insight.exerciseId}`} insight={insight} />
                    ))}
                  </div>
                </section>
              )}

              {/* 1RM progression — two-column grid */}
              {e1rmInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">1RM Estimado por Ejercicio</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {e1rmInsights.map((insight) => (
                      <E1rmChart
                        key={`${insight.insightType}-${insight.exerciseId}`}
                        insight={insight}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Forecasts — two-column grid */}
              {forecastInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">Pronóstico 1RM</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {forecastInsights.map((insight) => (
                      <ForecastChart key={`forecast-${insight.exerciseId}`} insight={insight} />
                    ))}
                  </div>
                </section>
              )}

              {/* Load recommendations — three-column grid */}
              {recommendationInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">Recomendación de Carga</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recommendationInsights.map((insight) => (
                      <LoadRecommendation key={`rec-${insight.exerciseId}`} insight={insight} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
