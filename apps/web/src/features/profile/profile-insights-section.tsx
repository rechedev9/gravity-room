import { useTranslation } from 'react-i18next';
import type { InsightItem } from '@/lib/api-functions';
import { VolumeTrendCard } from '@/features/insights/volume-trend-card';
import { FrequencyCard } from '@/features/insights/frequency-card';
import { PlateauAlert } from '@/features/insights/plateau-alert';
import { LoadRecommendation } from '@/features/insights/load-recommendation';
import { StaggerContainer, StaggerItem, fadeUpFastVariants } from '@/lib/motion-primitives';

interface ProfileInsightsSectionProps {
  readonly insights: readonly InsightItem[];
  readonly isLoading: boolean;
}

export function ProfileInsightsSection({
  insights,
  isLoading,
}: ProfileInsightsSectionProps): React.ReactNode {
  const { t } = useTranslation();

  const volumeTrend = insights.find((i) => i.insightType === 'volume_trend') ?? null;
  const frequency = insights.find((i) => i.insightType === 'frequency') ?? null;
  const plateauInsights = insights.filter((i) => i.insightType === 'plateau_detection');
  const recommendationInsights = insights.filter((i) => i.insightType === 'load_recommendation');

  const hasContent =
    volumeTrend || frequency || plateauInsights.length > 0 || recommendationInsights.length > 0;

  if (!hasContent && !isLoading) return null;

  return (
    <div className="mt-6 space-y-6">
      {/* Performance charts */}
      <section>
        <h2 className="dash-section-title mb-3">{t('dashboard.performance')}</h2>
        {isLoading && !hasContent && (
          <div className="bg-card border border-rule p-5 animate-pulse">
            <div className="h-3 w-32 bg-rule rounded mb-4" />
            <div className="h-36 bg-rule rounded" />
          </div>
        )}
        {(volumeTrend || frequency) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {volumeTrend && <VolumeTrendCard insight={volumeTrend} />}
            {frequency && <FrequencyCard insight={frequency} />}
          </div>
        )}
        {!volumeTrend && !frequency && !isLoading && (
          <div className="bg-card border border-rule p-6 text-center">
            <p className="text-xs text-muted">{t('dashboard.complete_workouts_message')}</p>
          </div>
        )}
      </section>

      {/* Plateau alerts */}
      {plateauInsights.length > 0 && (
        <section>
          <h2 className="dash-section-title mb-3">{t('dashboard.alerts')}</h2>
          <StaggerContainer
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            stagger={0.05}
          >
            {plateauInsights.map((insight) => (
              <StaggerItem key={`plateau-${insight.exerciseId}`} variants={fadeUpFastVariants}>
                <PlateauAlert insight={insight} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      )}

      {/* Load recommendations */}
      {recommendationInsights.length > 0 && (
        <section>
          <h2 className="dash-section-title mb-3">{t('dashboard.load_recommendation_section')}</h2>
          <StaggerContainer
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
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
  );
}
