import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';
import type { ProgramDefinition, GenericResults } from '@gzclp/domain/types/program';
import { queryKeys } from '@/lib/query-keys';
import { fetchGenericProgramDetail, fetchCatalogDetail } from '@/lib/api-functions';
import type { ProgramSummary } from '@/lib/api-functions';
import {
  buildHeroExtras,
  buildRecentSessions,
  buildLiftHistory,
  type HeroExtras,
  type RecentSessionRow,
} from './dashboard-view-models';
import type { LiftHistoryRow } from './use-pr-road';

interface DashboardData {
  readonly isLoading: boolean;
  /** True when either underlying fetch failed - consumers must surface it (never render a fake pristine state). */
  readonly isError: boolean;
  readonly refetch: () => void;
  readonly hero: HeroExtras;
  readonly recentSessions: readonly RecentSessionRow[];
  readonly liftHistory: readonly LiftHistoryRow[];
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
}

const EMPTY_HERO: HeroExtras = {};
const EMPTY_SESSIONS: readonly RecentSessionRow[] = [];
const EMPTY_HISTORY: readonly LiftHistoryRow[] = [];

/**
 * Loads the active program's full detail (logged results) plus its definition
 * and derives the Home dashboard's hero / recent-sessions / PR-road view models.
 *
 * Shares TanStack Query cache keys with the tracker (`useProgram`), so the
 * program detail is fetched once and stays consistent across both screens.
 * When there is no active program every query is disabled and the hook returns
 * empty view models, preserving the pristine first-run state.
 */
export function useDashboardData(activeProgram: ProgramSummary | null): DashboardData {
  const programId = activeProgram?.programId ?? '';
  const instanceId = activeProgram?.id ?? '';
  const isCustom = programId.startsWith('custom:');

  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(instanceId),
    queryFn: () => fetchGenericProgramDetail(instanceId),
    enabled: activeProgram !== null,
    // No forced refetch: every mutation that changes results invalidates or
    // patches this cache key (see use-program-mutations.ts), so a cached mount
    // is already fresh and a tracker<->home bounce costs zero requests.
  });

  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(programId),
    queryFn: () => fetchCatalogDetail(programId),
    enabled: activeProgram !== null && !isCustom,
    staleTime: 5 * 60 * 1000,
  });

  const detail = detailQuery.data ?? null;

  const definition = useMemo((): ProgramDefinition | undefined => {
    if (isCustom) {
      const parsed = ProgramDefinitionSchema.safeParse(detail?.customDefinition);
      return parsed.success ? parsed.data : undefined;
    }
    return catalogQuery.data;
  }, [isCustom, detail?.customDefinition, catalogQuery.data]);

  const config = detail?.config ?? null;
  const results: GenericResults = detail?.results ?? {};
  const resultTimestamps = detail?.resultTimestamps ?? {};

  const rows = useMemo(() => {
    if (!definition || !config) return [];
    return computeGenericProgram(definition, config, results);
  }, [definition, config, results]);

  const hero = useMemo(
    () => (rows.length > 0 ? buildHeroExtras(rows, definition?.totalWorkouts ?? 0) : EMPTY_HERO),
    [rows, definition?.totalWorkouts]
  );
  const recentSessions = useMemo(
    () => (rows.length > 0 ? buildRecentSessions(rows, resultTimestamps) : EMPTY_SESSIONS),
    [rows, resultTimestamps]
  );
  const liftHistory = useMemo(
    () => (rows.length > 0 ? buildLiftHistory(rows) : EMPTY_HISTORY),
    [rows]
  );

  const isLoading =
    activeProgram !== null && (detailQuery.isLoading || (!isCustom && catalogQuery.isLoading));
  const isError =
    activeProgram !== null && (detailQuery.isError || (!isCustom && catalogQuery.isError));

  const refetch = (): void => {
    void detailQuery.refetch();
    if (!isCustom) void catalogQuery.refetch();
  };

  return {
    isLoading,
    isError,
    refetch,
    hero,
    recentSessions,
    liftHistory,
    totalWorkouts: definition?.totalWorkouts ?? 0,
    workoutsPerWeek: definition?.workoutsPerWeek ?? 0,
  };
}
