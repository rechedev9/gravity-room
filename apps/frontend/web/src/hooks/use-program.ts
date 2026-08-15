import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import type {
  ProgramDefinition,
  GenericResults,
  GenericUndoHistory,
} from '@gzclp/domain/types/program';
import type { GenericWorkoutRow, ResultValue, SetLogEntry } from '@gzclp/domain/types';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogDetail,
  exportProgram,
  importProgram,
  type GenericProgramDetail,
} from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { captureError } from '@/lib/sentry';
import { patchSlotField as patchSlotFieldPure } from '@/lib/slot-result-helpers';
import { useProgramMutations } from '@/hooks/use-program-mutations';

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

export interface UseProgramReturn {
  readonly definition: ProgramDefinition | undefined;
  readonly config: Record<string, number | string> | null;
  readonly metadata: unknown;
  readonly rows: readonly GenericWorkoutRow[];
  /** Raw per-slot results — the engine input behind `rows`, needed for progression previews. */
  readonly results: GenericResults;
  readonly undoHistory: GenericUndoHistory;
  readonly resultTimestamps: Readonly<Record<string, string>>;
  readonly completedDates: Readonly<Record<string, string>>;
  readonly isLoading: boolean;
  readonly isGenerating: boolean;
  readonly activeInstanceId: string | null;
  readonly generateProgram: (config: Record<string, number | string>) => Promise<void>;
  readonly updateConfig: (config: Record<string, number | string>) => void;
  readonly updateMetadata: (metadata: Record<string, unknown>) => void;
  readonly markResult: (
    index: number,
    slotId: string,
    value: ResultValue,
    setLogs?: readonly SetLogEntry[]
  ) => void;
  readonly setAmrapReps: (index: number, slotId: string, reps: number | undefined) => void;
  readonly setRpe: (index: number, slotId: string, rpe: number | undefined) => void;
  readonly undoSpecific: (index: number, slotId: string) => void;
  readonly undoLast: () => void;
  readonly finishProgram: () => Promise<void>;
  readonly isFinishing: boolean;
  readonly resetAll: (onSuccess?: () => void) => void;
  readonly exportData: () => void;
  readonly importData: (json: string) => Promise<boolean>;
  /** Await-able version of updateConfig for sequential flows. */
  readonly updateConfigAsync: (config: Record<string, number | string>) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export interface UseProgramOptions {
  /** When false, skip all network queries (guest tracker path). */
  readonly enabled?: boolean;
}

export function useProgram(
  programId: string,
  instanceId?: string,
  options?: UseProgramOptions
): UseProgramReturn {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const enabled = options?.enabled ?? true;

  // Per-key debounce timers for high-frequency mutations (AMRAP, RPE).
  // Key format: `${workoutIndex}-${slotId}` — each unique slot has its own timer.
  const amrapTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const rpeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Rollback baseline per key: the field value that was in the cache before the
  // current edit *session* started (a session = one or more keystrokes coalesced
  // by the debounce below). Set once when a session opens and left untouched by
  // subsequent keystrokes in the same session, so the eventual mutate() carries
  // the true pre-session value for onError to restore to — not the
  // already-optimistic value the previous keystroke just wrote.
  const amrapBaselines = useRef<Map<string, number | undefined>>(new Map());
  const rpeBaselines = useRef<Map<string, number | undefined>>(new Map());

  // Clear all pending debounce timers on unmount to prevent mutations firing
  // after the component has been destroyed.
  useEffect(() => {
    return () => {
      amrapTimers.current.forEach(clearTimeout);
      rpeTimers.current.forEach(clearTimeout);
    };
  }, []);

  const isCustom = programId.startsWith('custom:');

  // Fetch the program definition from the catalog API (custom: programs have no catalog entry)
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(programId),
    queryFn: () => fetchCatalogDetail(programId),
    staleTime: 5 * 60 * 1000,
    enabled: enabled && !isCustom,
  });

  // Fetch the list of programs to find the active one
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: enabled && user !== null,
  });

  // Use provided instanceId, or find active instance with matching programId
  const activeInstanceId = (() => {
    if (!enabled) return null;
    if (instanceId) return instanceId;
    if (!programsQuery.data) return null;
    return (
      programsQuery.data.find((p) => p.status === 'active' && p.programId === programId)?.id ?? null
    );
  })();

  // Fetch the full program detail in generic format
  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
    queryFn: () => fetchGenericProgramDetail(activeInstanceId ?? ''),
    enabled: enabled && activeInstanceId !== null,
  });

  const detail = detailQuery.data ?? null;
  const config = detail?.config ?? null;
  const metadata: unknown = detail?.metadata ?? null;
  const results: GenericResults = detail?.results ?? {};
  const undoHistory: GenericUndoHistory = detail?.undoHistory ?? [];
  const resultTimestamps: Readonly<Record<string, string>> = detail?.resultTimestamps ?? {};
  const completedDates: Readonly<Record<string, string>> = detail?.completedDates ?? {};

  const definition: ProgramDefinition | undefined = catalogQuery.data;

  const isLoading =
    (!isCustom && catalogQuery.isLoading) || programsQuery.isLoading || detailQuery.isLoading;

  // Compute rows from definition + config + results (memoized — avoids O(W×S) replay on every render)
  const rows: readonly GenericWorkoutRow[] = useMemo(() => {
    if (!definition || !config) return [];
    return computeGenericProgram(definition, config, results);
  }, [definition, config, results]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const {
    markResultMutation,
    setAmrapMutation,
    setRpeMutation,
    undoSpecificMutation,
    undoLastMutation,
    generateProgramMutation,
    updateConfigMutation,
    updateMetadataMutation,
    finishProgramMutation,
    resetAllMutation,
  } = useProgramMutations({
    activeInstanceId,
    programId,
    definition,
    queryClient,
    toast,
    t,
  });

  // -------------------------------------------------------------------------
  // Stable callbacks — mutate() identities are stable in TanStack Query v5;
  // wrap so consumers can put them in effect/deps without thrashing.
  // -------------------------------------------------------------------------

  const markResultMutate = markResultMutation.mutate;
  const setAmrapMutate = setAmrapMutation.mutate;
  const setRpeMutate = setRpeMutation.mutate;
  const undoSpecificMutate = undoSpecificMutation.mutate;
  const undoLastMutate = undoLastMutation.mutate;
  const generateProgramMutateAsync = generateProgramMutation.mutateAsync;
  const updateConfigMutate = updateConfigMutation.mutate;
  const updateConfigMutateAsync = updateConfigMutation.mutateAsync;
  const updateMetadataMutate = updateMetadataMutation.mutate;
  const finishProgramMutateAsync = finishProgramMutation.mutateAsync;
  const resetAllMutate = resetAllMutation.mutate;

  const markResultCb = useCallback(
    (index: number, slotId: string, value: ResultValue, setLogs?: readonly SetLogEntry[]): void => {
      markResultMutate({ index, slotId, value, setLogs });
    },
    [markResultMutate]
  );

  /**
   * Patch a single field on a slot entry in the cached program detail.
   * Returns the field's value immediately before this patch, so callers can
   * capture a true pre-edit snapshot for rollback purposes.
   */
  const patchSlotField = useCallback(
    (
      index: number,
      slotId: string,
      field: 'amrapReps' | 'rpe',
      value: number | undefined
    ): number | undefined => {
      const detailKey = queryKeys.programs.detail(activeInstanceId ?? '');
      let previousValue: number | undefined;
      queryClient.setQueryData<GenericProgramDetail>(detailKey, (prev) => {
        if (!prev) return prev;
        previousValue = prev.results[String(index)]?.[slotId]?.[field];
        return { ...prev, results: patchSlotFieldPure(prev.results, index, slotId, field, value) };
      });
      return previousValue;
    },
    [activeInstanceId, queryClient]
  );

  const setAmrapRepsCb = useCallback(
    (index: number, slotId: string, reps: number | undefined): void => {
      const timerKey = `${index}-${slotId}`;
      const previousValue = patchSlotField(index, slotId, 'amrapReps', reps);
      // Only stamp the baseline when no session is already open — mid-session
      // keystrokes must not overwrite the true pre-session value with their own
      // (already optimistic) previous value.
      if (!amrapBaselines.current.has(timerKey)) {
        amrapBaselines.current.set(timerKey, previousValue);
      }

      // Debounce the API call: rapid clicks on +/- coalesce into a single POST.
      const existing = amrapTimers.current.get(timerKey);
      if (existing !== undefined) clearTimeout(existing);
      amrapTimers.current.set(
        timerKey,
        setTimeout(() => {
          amrapTimers.current.delete(timerKey);
          const previousReps = amrapBaselines.current.get(timerKey);
          amrapBaselines.current.delete(timerKey);
          setAmrapMutate({ index, slotId, reps, previousReps });
        }, 400)
      );
    },
    [patchSlotField, setAmrapMutate]
  );

  const setRpeCb = useCallback(
    (index: number, slotId: string, rpe: number | undefined): void => {
      const timerKey = `${index}-${slotId}-rpe`;
      const previousValue = patchSlotField(index, slotId, 'rpe', rpe);
      if (!rpeBaselines.current.has(timerKey)) {
        rpeBaselines.current.set(timerKey, previousValue);
      }

      // Debounce: switching RPE values rapidly fires one POST after 300ms.
      const existing = rpeTimers.current.get(timerKey);
      if (existing !== undefined) clearTimeout(existing);
      rpeTimers.current.set(
        timerKey,
        setTimeout(() => {
          rpeTimers.current.delete(timerKey);
          const previousRpe = rpeBaselines.current.get(timerKey);
          rpeBaselines.current.delete(timerKey);
          setRpeMutate({ index, slotId, rpe, previousRpe });
        }, 300)
      );
    },
    [patchSlotField, setRpeMutate]
  );

  const undoSpecificCb = useCallback(
    (index: number, slotId: string): void => {
      undoSpecificMutate({ index, slotId });
    },
    [undoSpecificMutate]
  );

  const undoLastCb = useCallback((): void => {
    undoLastMutate();
  }, [undoLastMutate]);

  const generateProgramCb = useCallback(
    async (newConfig: Record<string, number | string>): Promise<void> => {
      await generateProgramMutateAsync(newConfig);
    },
    [generateProgramMutateAsync]
  );

  const updateConfigCb = useCallback(
    (newConfig: Record<string, number | string>): void => {
      updateConfigMutate(newConfig);
    },
    [updateConfigMutate]
  );

  const updateConfigAsyncCb = useCallback(
    async (newConfig: Record<string, number | string>): Promise<void> => {
      if (!activeInstanceId) throw new Error('No active program');
      await updateConfigMutateAsync(newConfig);
    },
    [activeInstanceId, updateConfigMutateAsync]
  );

  const updateMetadataCb = useCallback(
    (newMetadata: Record<string, unknown>): void => {
      updateMetadataMutate(newMetadata);
    },
    [updateMetadataMutate]
  );

  const finishProgramCb = useCallback(async (): Promise<void> => {
    await finishProgramMutateAsync();
  }, [finishProgramMutateAsync]);

  const resetAllCb = useCallback(
    (onSuccess?: () => void): void => {
      // Capture the instanceId at call-time: by the time onSuccess fires, the
      // activeInstanceId closure may already have flipped to null.
      const idToRemove = activeInstanceId;
      resetAllMutate(undefined, {
        onSuccess: () => {
          // Remove the stale detail cache so the setup form shows immediately.
          // Disabling a query (enabled: false) keeps cached data alive — evict it.
          if (idToRemove) {
            queryClient.removeQueries({ queryKey: queryKeys.programs.detail(idToRemove) });
          }
          onSuccess?.();
        },
      });
    },
    [activeInstanceId, queryClient, resetAllMutate]
  );

  const exportDataCb = useCallback(async (): Promise<void> => {
    if (!activeInstanceId) return;
    try {
      const data = await exportProgram(activeInstanceId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${programId}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      captureError(err);
      toast({ message: t('tracker.errors.program_export_failed') });
    }
  }, [activeInstanceId, programId, t, toast]);

  const importDataCb = useCallback(
    async (json: string): Promise<boolean> => {
      try {
        const parsed: unknown = JSON.parse(json);
        await importProgram(parsed);
        // Importing adds a new program to the list; no existing detail cache
        // applies to it, so keep the invalidation scoped to the list.
        void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all, exact: true });
        return true;
      } catch (err: unknown) {
        captureError(err);
        toast({ message: t('tracker.errors.program_import_failed') });
        return false;
      }
    },
    [queryClient, t, toast]
  );

  return useMemo(
    (): UseProgramReturn => ({
      definition,
      config,
      metadata,
      rows,
      results,
      undoHistory,
      resultTimestamps,
      completedDates,
      isLoading,
      isGenerating: generateProgramMutation.isPending,
      activeInstanceId,
      generateProgram: generateProgramCb,
      updateConfig: updateConfigCb,
      updateMetadata: updateMetadataCb,
      markResult: markResultCb,
      setAmrapReps: setAmrapRepsCb,
      setRpe: setRpeCb,
      undoSpecific: undoSpecificCb,
      undoLast: undoLastCb,
      finishProgram: finishProgramCb,
      isFinishing: finishProgramMutation.isPending,
      resetAll: resetAllCb,
      exportData: exportDataCb,
      importData: importDataCb,
      updateConfigAsync: updateConfigAsyncCb,
    }),
    [
      definition,
      config,
      metadata,
      rows,
      results,
      undoHistory,
      resultTimestamps,
      completedDates,
      isLoading,
      generateProgramMutation.isPending,
      activeInstanceId,
      generateProgramCb,
      updateConfigCb,
      updateMetadataCb,
      markResultCb,
      setAmrapRepsCb,
      setRpeCb,
      undoSpecificCb,
      undoLastCb,
      finishProgramCb,
      finishProgramMutation.isPending,
      resetAllCb,
      exportDataCb,
      importDataCb,
      updateConfigAsyncCb,
    ]
  );
}
