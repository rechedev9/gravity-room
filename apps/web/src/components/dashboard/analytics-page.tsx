import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchInsights } from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { GuestBanner } from '@/components/guest-banner';
import { VolumeTrendCard } from './volume-trend-card';
import { FrequencyCard } from './frequency-card';
import { E1rmChart } from './e1rm-chart';

const INSIGHT_TYPES = ['volume_trend', 'frequency', 'e1rm_progression'] as const;

export function AnalyticsPage(): React.ReactNode {
  const { user } = useAuth();
  const { isGuest } = useGuest();

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

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <h1 className="font-display text-3xl text-title tracking-wide mb-1">Analíticas</h1>
        <p className="text-sm text-muted mb-8">Rendimiento pre-calculado cada 6 horas.</p>

        {isGuest && <GuestBanner className="mb-6" />}

        {!isGuest && insightsQuery.isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-card border border-rule p-5 animate-pulse">
                <div className="h-3 w-32 bg-rule rounded mb-4" />
                <div className="h-36 bg-rule rounded" />
              </div>
            ))}
          </div>
        )}

        {!isGuest && insightsQuery.isError && (
          <div className="bg-card border border-rule p-6 text-center">
            <p className="text-sm text-muted">No se pudieron cargar las analíticas.</p>
          </div>
        )}

        {!isGuest && insightsQuery.isSuccess && !insightsQuery.data?.length && (
          <div className="bg-card border border-rule p-6 text-center">
            <p className="text-sm text-muted">
              Sin datos todavía. Completa algunos entrenamientos para ver tus analíticas.
            </p>
          </div>
        )}

        {!isGuest &&
          insightsQuery.isSuccess &&
          insightsQuery.data &&
          insightsQuery.data.length > 0 && (
            <div className="space-y-6">
              {frequency && <FrequencyCard insight={frequency} />}
              {volumeTrend && <VolumeTrendCard insight={volumeTrend} />}

              {e1rmInsights.length > 0 && (
                <section>
                  <h2 className="section-label mb-4">1RM Estimado por Ejercicio</h2>
                  <div className="space-y-4">
                    {e1rmInsights.map((insight) => (
                      <E1rmChart
                        key={`${insight.insightType}-${insight.exerciseId}`}
                        insight={insight}
                      />
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
