import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listProgramSummaries,
  upsertProgramSummaries,
  type ProgramSummary,
} from './program-repository';
import { fetchProgramSummaries } from './program-service';

export const PROGRAM_SUMMARIES_KEY = ['program-summaries'] as const;
export interface ProgramSummariesData {
  readonly programs: readonly ProgramSummary[];
  readonly cached: boolean;
}

export function requireLiveQuery(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('Query cancelled');
}

export function useProgramSummaries(enabled = true) {
  const client = useQueryClient();
  return useQuery<ProgramSummariesData>({
    queryKey: PROGRAM_SUMMARIES_KEY,
    enabled,
    queryFn: async ({ signal }) => {
      let cached: ProgramSummary[];
      try {
        cached = await listProgramSummaries();
      } catch {
        throw new Error('load');
      }
      requireLiveQuery(signal);
      if (cached.length > 0)
        client.setQueryData(PROGRAM_SUMMARIES_KEY, { programs: cached, cached: false });
      try {
        const remote = await fetchProgramSummaries();
        requireLiveQuery(signal);
        await upsertProgramSummaries(remote);
        requireLiveQuery(signal);
        const programs = await listProgramSummaries();
        requireLiveQuery(signal);
        return { programs, cached: false };
      } catch {
        requireLiveQuery(signal);
        if (cached.length > 0) return { programs: cached, cached: true };
        throw new Error('sync');
      }
    },
  });
}
