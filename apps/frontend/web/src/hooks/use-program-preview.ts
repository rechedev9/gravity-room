import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import { buildProgramConfig } from '@gzclp/domain/program-config';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { queryKeys } from '@/lib/query-keys';
import { fetchCatalogDetail } from '@/lib/api-functions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALE_TIME_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface UseProgramPreviewReturn {
  /** The full program definition from the catalog API. */
  readonly definition: ProgramDefinition | undefined;
  /** Computed workout rows with default weights and empty results. */
  readonly rows: readonly GenericWorkoutRow[];
  /** True while the catalog detail query is loading. */
  readonly isLoading: boolean;
  /** True if the catalog detail query failed. */
  readonly isError: boolean;
  /** The error object if the query failed, null otherwise. */
  readonly error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const EMPTY_RESULTS = {} as const;

export function useProgramPreview(programId: string): UseProgramPreviewReturn {
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(programId),
    queryFn: () => fetchCatalogDetail(programId),
    staleTime: STALE_TIME_MS,
  });

  const definition = catalogQuery.data;

  const defaultConfig = useMemo(() => {
    if (!definition) return null;
    return buildProgramConfig(definition);
  }, [definition]);

  const rows: readonly GenericWorkoutRow[] = useMemo(() => {
    if (!definition || !defaultConfig) return [];
    return computeGenericProgram(definition, defaultConfig, EMPTY_RESULTS);
  }, [definition, defaultConfig]);

  const error = catalogQuery.error instanceof Error ? catalogQuery.error : null;

  return {
    definition,
    rows,
    isLoading: catalogQuery.isLoading,
    isError: catalogQuery.isError,
    error,
  };
}
