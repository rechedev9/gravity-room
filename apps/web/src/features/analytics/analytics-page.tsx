import { useTranslation } from 'react-i18next';
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
import { StaggerContainer, StaggerItem, fadeUpFastVariants } from '@/lib/motion-primitives';

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest } = useGuest();

  useDocumentTitle(t('analytics.page.title'));

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
              {t('analytics.page.heading')}
            </h1>
            <p className="text-xs text-muted mt-0.5">{t('analytics.page.subtitle')}</p>
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
            <p className="text-sm text-muted">{t('analytics.error.loading')}</p>
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
            <p className="text-sm text-muted">{t('analytics.empty.message')}</p>
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
                  <h2 className="dash-section-title mb-3">{t('analytics.sections.overview')}</h2>
                  <StaggerContainer
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                    stagger={0.05}
                  >
                    {frequency && (
                      <StaggerItem variants={fadeUpFastVariants}>
                        <FrequencyCard insight={frequency} />
                      </StaggerItem>
                    )}
                    {volumeTrend && (
                      <StaggerItem variants={fadeUpFastVariants}>
                        <VolumeTrendCard insight={volumeTrend} />
                      </StaggerItem>
                    )}
                  </StaggerContainer>
                </section>
              )}

              {/* Exercise summary — compact grid per slot */}
              {exerciseSummaryInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">
                    {t('analytics.sections.exercise_summary')}
                  </h2>
                  <StaggerContainer
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                    stagger={0.05}
                  >
                    {exerciseSummaryInsights.map((insight) => (
                      <StaggerItem
                        key={`summary-${insight.exerciseId}`}
                        variants={fadeUpFastVariants}
                      >
                        <ExerciseSummaryCard insight={insight} />
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </section>
              )}

              {/* Plateau alerts — full width banner-style */}
              {plateauInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">
                    {t('analytics.sections.plateau_alerts')}
                  </h2>
                  <StaggerContainer
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                    stagger={0.05}
                  >
                    {plateauInsights.map((insight) => (
                      <StaggerItem
                        key={`plateau-${insight.exerciseId}`}
                        variants={fadeUpFastVariants}
                      >
                        <PlateauAlert insight={insight} />
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </section>
              )}

              {/* 1RM progression — two-column grid */}
              {e1rmInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">
                    {t('analytics.sections.e1rm_progression')}
                  </h2>
                  <StaggerContainer
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                    stagger={0.05}
                  >
                    {e1rmInsights.map((insight) => (
                      <StaggerItem
                        key={`${insight.insightType}-${insight.exerciseId}`}
                        variants={fadeUpFastVariants}
                      >
                        <E1rmChart insight={insight} />
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </section>
              )}

              {/* Forecasts — two-column grid */}
              {forecastInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">
                    {t('analytics.sections.e1rm_forecast')}
                  </h2>
                  <StaggerContainer
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                    stagger={0.05}
                  >
                    {forecastInsights.map((insight) => (
                      <StaggerItem
                        key={`forecast-${insight.exerciseId}`}
                        variants={fadeUpFastVariants}
                      >
                        <ForecastChart insight={insight} />
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </section>
              )}

              {/* Load recommendations — three-column grid */}
              {recommendationInsights.length > 0 && (
                <section>
                  <h2 className="dash-section-title mb-3">
                    {t('analytics.sections.load_recommendation')}
                  </h2>
                  <StaggerContainer
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    stagger={0.05}
                  >
                    {recommendationInsights.map((insight) => (
                      <StaggerItem key={`rec-${insight.exerciseId}`} variants={fadeUpFastVariants}>
                        <LoadRecommendation insight={insight} />
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </section>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
