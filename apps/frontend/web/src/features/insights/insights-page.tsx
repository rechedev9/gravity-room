import { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useAuth } from '@/contexts/auth-context';
import { fetchInsights } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { isVolumeTrendPayload, isFrequencyPayload } from '@/lib/insight-payloads';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { Kicker } from '@/components/kicker';
import { Tag } from '@/components/tag';
import { StatBlock } from '@/components/stat-block';
import { CornerTicks } from '@/components/corner-ticks';
import { FrequencyCard } from './frequency-card';
import { PlateauAlert } from './plateau-alert';
import { LoadRecommendation } from './load-recommendation';

// VolumeTrendCard pulls in recharts; keep it out of the insights preload chunk.
const VolumeTrendCard = lazyWithRetry(() =>
  import('./volume-trend-card').then((m) => ({ default: m.VolumeTrendCard }))
);

const INSIGHT_TYPES = [
  'volume_trend',
  'frequency',
  'plateau_detection',
  'load_recommendation',
] as const;

function ChartFallback(): React.ReactNode {
  return (
    <div className="border border-rule bg-card p-5 animate-pulse">
      <div className="mb-4 h-3 w-32 rounded bg-rule" />
      <div className="h-48 rounded bg-rule" />
    </div>
  );
}

export function InsightsPage(): React.ReactNode {
  const { t } = useTranslation();
  const { user } = useAuth();
  useDocumentTitle(t('insights.page.title'));

  const insightsQuery = useQuery({
    queryKey: queryKeys.insights.list([...INSIGHT_TYPES]),
    queryFn: () => fetchInsights([...INSIGHT_TYPES]),
    enabled: user !== null,
    staleTime: 10 * 60 * 1000,
  });

  const insights = insightsQuery.data ?? [];

  const volumeTrend = insights.find((i) => i.insightType === 'volume_trend') ?? null;
  const frequency = insights.find((i) => i.insightType === 'frequency') ?? null;
  const plateaus = insights.filter((i) => i.insightType === 'plateau_detection');
  const recommendations = insights.filter((i) => i.insightType === 'load_recommendation');

  // Headline stats derived from the real payloads — no fabricated data.
  const stats = useMemo(() => {
    const volPayload = volumeTrend?.payload;
    const freqPayload = frequency?.payload;
    const latestVolume =
      volPayload && isVolumeTrendPayload(volPayload)
        ? (volPayload.volumes[volPayload.volumes.length - 1] ?? null)
        : null;
    const direction = volPayload && isVolumeTrendPayload(volPayload) ? volPayload.direction : null;
    const sessions =
      freqPayload && isFrequencyPayload(freqPayload) ? freqPayload.totalSessions : null;
    return { latestVolume, direction, sessions };
  }, [volumeTrend, frequency]);

  const hasContent =
    volumeTrend !== null || frequency !== null || plateaus.length > 0 || recommendations.length > 0;

  const directionLabel =
    stats.direction === 'up'
      ? t('insights.volume_trend.direction_up')
      : stats.direction === 'down'
        ? t('insights.volume_trend.direction_down')
        : t('insights.volume_trend.direction_stable');

  return (
    <div className="min-h-dvh bg-body">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 sm:py-8">
        {/* Screen header */}
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <Kicker noRule className="mb-2">
              {t('insights.page.meta')}
            </Kicker>
            <h1 className="font-display text-4xl leading-none text-main sm:text-5xl">
              {t('insights.page.title')}
            </h1>
          </div>
          {hasContent && <Tag tone="gold">{t('insights.page.updated_today')}</Tag>}
        </header>

        {!hasContent && !insightsQuery.isLoading ? (
          <div className="border border-rule bg-card px-6 py-16 text-center">
            <Kicker noRule className="justify-center">
              {t('insights.page.title')}
            </Kicker>
            <p className="mt-4 font-display text-3xl text-muted sm:text-4xl">
              {t('insights.page.empty_heading')}
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              {t('insights.page.empty_description')}
            </p>
          </div>
        ) : (
          <>
            {/* Headline stats */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatBlock
                label={t('insights.volume_trend.title')}
                value={stats.latestVolume !== null ? stats.latestVolume.toLocaleString() : '—'}
                sub={stats.latestVolume !== null ? `kg · ${directionLabel}` : undefined}
                gold
              />
              <StatBlock
                label={t('insights.frequency.title')}
                value={stats.sessions !== null ? String(stats.sessions) : '—'}
                sub={t('insights.frequency.total_sessions_label')}
              />
              <StatBlock
                label={t('insights.page.meta')}
                value={String(plateaus.length + recommendations.length)}
                sub={t('insights.page.section_signals')}
              />
            </div>

            {/* Trends (left) + signals rail (right) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="flex flex-col gap-4">
                <Kicker index="01">{t('insights.page.section_charts')}</Kicker>
                {volumeTrend ? (
                  <Suspense fallback={<ChartFallback />}>
                    <VolumeTrendCard insight={volumeTrend} />
                  </Suspense>
                ) : (
                  <ChartFallback />
                )}
                {frequency && <FrequencyCard insight={frequency} />}
              </div>

              <div className="flex flex-col gap-4">
                <Kicker index="02">{t('insights.page.section_signals')}</Kicker>
                {recommendations.length > 0 && (
                  <div className="relative">
                    {/* Hatch strip + register ticks mark the scarce gold signal of this view */}
                    <div className="hatch absolute inset-x-0 top-0 h-1.5" aria-hidden />
                    <CornerTicks />
                    <div className="flex flex-col gap-3 pt-1.5">
                      {recommendations.map((insight) => (
                        <LoadRecommendation
                          key={`rec-${insight.exerciseId ?? insight.insightType}`}
                          insight={insight}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {plateaus.map((insight) => (
                  <PlateauAlert
                    key={`plateau-${insight.exerciseId ?? insight.insightType}`}
                    insight={insight}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
