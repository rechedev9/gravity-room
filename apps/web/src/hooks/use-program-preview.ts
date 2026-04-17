import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow } from '@gzclp/shared/types';
import { queryKeys } from '@/lib/query-keys';
import { fetchCatalogDetail } from '@/lib/api-functions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALE_TIME_MS = 5 * 60 * 1000;
const DEFAULT_WEIGHT_FALLBACK = 20;
const DEFAULT_WEIGHT_MULTIPLIER = 8;

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
// Default config builder (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Builds a default config from a program definition's configFields.
 * - Weight fields: uses `min` if > 0, otherwise `step * 8` (fallback 20 kg).
 * - Select fields: uses the first option's value.
 */
export function buildDefaultConfig(
  configFields: ProgramDefinition['configFields']
): Record<string, number | string> {
  const config: Record<string, number | string> = {};

  for (const field of configFields) {
    if (field.type === 'weight') {
      config[field.key] =
        field.min > 0
          ? field.min
          : field.step * DEFAULT_WEIGHT_MULTIPLIER || DEFAULT_WEIGHT_FALLBACK;
    } else {
      config[field.key] = field.options[0].value;
    }
  }

  return config;
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
    return buildDefaultConfig(definition.configFields);
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
