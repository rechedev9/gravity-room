import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchGenericProgramDetail, fetchCatalogDetail } from '@/lib/api-functions';
import type { ProgramSummary } from '@/lib/api-functions';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { computeProfileData, formatVolume } from '@/lib/profile-stats';
import { parseCustomDefinition } from '@/lib/program-utils';
import { KpiCard } from './kpi-card';

interface KpiSummaryProps {
  readonly programs: readonly ProgramSummary[];
}

export function KpiSummary({ programs }: KpiSummaryProps): React.ReactNode {
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

  const activePct = profileData?.completion.completionPct ?? null;
  const streak = profileData?.streak.current ?? 0;
  const totalVolume = profileData?.volume.totalVolume ?? null;
  const workoutsCompleted = profileData?.completion.workoutsCompleted ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
      <KpiCard label="Racha" value={streak} sub="seguidos" accent loading={isLoading} />
      <KpiCard
        label="Programa"
        value={activePct !== null ? `${activePct}%` : '—'}
        sub="completado"
        loading={isLoading}
      />
      <KpiCard
        label="Volumen total"
        value={totalVolume !== null ? formatVolume(totalVolume) : '—'}
        sub="kg"
        loading={isLoading}
      />
      <KpiCard label="Sesiones" value={workoutsCompleted} sub="completadas" loading={isLoading} />
    </div>
  );
}
