import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchGenericProgramDetail, fetchCatalogDetail } from '@/lib/api-functions';
import type { InsightItem, ProgramSummary } from '@/lib/api-functions';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { computeProfileData, formatVolume } from '@/lib/profile-stats';
import { parseCustomDefinition } from '@/lib/program-utils';
import { isFrequencyPayload, isVolumeTrendPayload, isE1rmPayload } from '@/lib/insight-payloads';
import { KpiCard } from './kpi-card';

interface KpiSummaryProps {
  readonly programs: readonly ProgramSummary[];
  readonly insights: readonly InsightItem[];
  readonly isLoadingInsights: boolean;
}

export function KpiSummary({
  programs,
  insights,
  isLoadingInsights,
}: KpiSummaryProps): React.ReactNode {
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

  const definition = useMemo<ProgramDefinition | undefined>(() => {
    if (!active) return undefined;
    if (active.programId.startsWith('custom:')) {
      return parseCustomDefinition(detailQuery.data?.customDefinition);
    }
    return catalogQuery.data;
  }, [active, detailQuery.data?.customDefinition, catalogQuery.data]);

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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
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
        accent
        loading={loadingKpi}
      />
    </div>
  );
}
