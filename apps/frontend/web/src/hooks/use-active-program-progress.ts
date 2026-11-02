import { useQuery } from '@tanstack/react-query';
import { fetchPrograms, type ProgramSummary } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { useDashboardData } from '@/features/dashboard/use-dashboard-data';
import type { ProgramProgress } from '@/features/dashboard/dashboard-view-models';

export interface ActiveProgramProgress {
  readonly activeProgram: ProgramSummary | null;
  readonly programProgress: ProgramProgress | null;
  readonly workoutsPerWeek: number;
}

/**
 * The active program plus its live progress, from the cache Home and the
 * tracker already fill (no extra requests once either has loaded). Shared by
 * the sidebar card and the ⌘K palette so both read the same numbers.
 */
export function useActiveProgramProgress(enabled: boolean): ActiveProgramProgress {
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled,
  });
  const activeProgram = enabled
    ? (programsQuery.data?.find((program) => program.status === 'active') ?? null)
    : null;
  const { programProgress, workoutsPerWeek } = useDashboardData(activeProgram);

  return { activeProgram, programProgress, workoutsPerWeek };
}
