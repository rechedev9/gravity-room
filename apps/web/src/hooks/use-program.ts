import { useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
import { isRecord } from '@gzclp/shared/type-guards';
import type {
  ProgramDefinition,
  GenericResults,
  GenericUndoHistory,
} from '@gzclp/shared/types/program';
import type { GenericWorkoutRow, ResultValue } from '@gzclp/shared/types';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchPrograms,
  fetchGenericProgramDetail,
  fetchCatalogDetail,
  createProgram,
  updateProgramConfig,
  updateProgramMetadata,
  completeProgram,
  deleteProgram,
  recordGenericResult,
  deleteGenericResult,
  undoLastResult,
  exportProgram,
  importProgram,
  type GenericProgramDetail,
  type ProgramSummary,
} from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';

// ---------------------------------------------------------------------------
// Optimistic update helpers (generic slot-keyed format)
// ---------------------------------------------------------------------------

function setSlotResultOptimistic(
  prev: GenericResults,
  workoutIndex: number,
  slotId: string,
  result: ResultValue,
  amrapReps?: number
): GenericResults {
  const key = String(workoutIndex);
  const existing = prev[key] ?? {};
  return {
    ...prev,
    [key]: {
      ...existing,
      [slotId]: {
        ...existing[slotId],
        result,
        ...(amrapReps !== undefined ? { amrapReps } : {}),
      },
    },
  };
}

function removeSlotResult(
  results: GenericResults,
  workoutIndex: number,
  slotId: string
): GenericResults {
  const key = String(workoutIndex);
  const updated = { ...results };
  if (updated[key]) {
    const entry = { ...updated[key] };
    delete entry[slotId];
    if (Object.keys(entry).length === 0) {
      delete updated[key];
    } else {
      updated[key] = entry;
    }
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Shared optimistic mutation lifecycle callbacks
// ---------------------------------------------------------------------------

interface OptimisticContext {
  readonly previousDetail: GenericProgramDetail | undefined;
}

function optimisticDetailCallbacks(
  queryClient: QueryClient,
  instanceId: string | null
): {
  snapshotAndUpdate: (
    updater: (prev: GenericProgramDetail) => GenericProgramDetail
  ) => Promise<OptimisticContext>;
  onError: (_err: unknown, _vars: unknown, context: OptimisticContext | undefined) => void;
  onSettled: () => void;
} {
  const detailKey = queryKeys.programs.detail(instanceId ?? '');

  return {
    snapshotAndUpdate: async (updater) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previousDetail = queryClient.getQueryData<GenericProgramDetail>(detailKey);
      if (previousDetail) {
        queryClient.setQueryData<GenericProgramDetail>(detailKey, updater(previousDetail));
      }
      return { previousDetail };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
  };
}

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

export interface UseProgramReturn {
  readonly definition: ProgramDefinition | undefined;
  readonly config: Record<string, number | string> | null;
  readonly metadata: unknown;
  readonly rows: readonly GenericWorkoutRow[];
  readonly undoHistory: GenericUndoHistory;
  readonly resultTimestamps: Readonly<Record<string, string>>;
  readonly isLoading: boolean;
  readonly isGenerating: boolean;
  readonly activeInstanceId: string | null;
  readonly generateProgram: (config: Record<string, number | string>) => Promise<void>;
  readonly updateConfig: (config: Record<string, number | string>) => void;
  readonly updateMetadata: (metadata: Record<string, unknown>) => void;
  readonly markResult: (index: number, slotId: string, value: ResultValue) => void;
  readonly setAmrapReps: (index: number, slotId: string, reps: number | undefined) => void;
  readonly setRpe: (index: number, slotId: string, rpe: number | undefined) => void;
  readonly undoSpecific: (index: number, slotId: string) => void;
  readonly undoLast: () => void;
  readonly finishProgram: () => Promise<void>;
  readonly isFinishing: boolean;
  readonly resetAll: (onSuccess?: () => void) => void;
  readonly exportData: () => void;
  readonly importData: (json: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useProgram(programId: string, instanceId?: string): UseProgramReturn {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // Per-key debounce timers for high-frequency mutations (AMRAP, RPE).
  // Key format: `${workoutIndex}-${slotId}` — each unique slot has its own timer.
  const amrapTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const rpeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fetch the program definition from the catalog API
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(programId),
    queryFn: () => fetchCatalogDetail(programId),
    staleTime: 5 * 60 * 1000,
  });

  const definition = catalogQuery.data;

  // Fetch the list of programs to find the active one
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null,
  });

  // Use provided instanceId, or find active instance with matching programId
  const activeInstanceId = (() => {
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
    enabled: activeInstanceId !== null,
  });

  const detail = detailQuery.data ?? null;
  const config = detail?.config ?? null;
  const metadata: unknown = detail?.metadata ?? null;
  const results: GenericResults = detail?.results ?? {};
  const undoHistory: GenericUndoHistory = detail?.undoHistory ?? [];
  const resultTimestamps: Readonly<Record<string, string>> = detail?.resultTimestamps ?? {};
  const isLoading = catalogQuery.isLoading || programsQuery.isLoading || detailQuery.isLoading;

  // Compute rows from definition + config + results (memoized — avoids O(W×S) replay on every render)
  const rows: readonly GenericWorkoutRow[] = useMemo(() => {
    if (!definition || !config) return [];
    return computeGenericProgram(definition, config, results);
  }, [definition, config, results]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const {
    snapshotAndUpdate,
    onError: detailOnError,
    onSettled: detailOnSettled,
  } = optimisticDetailCallbacks(queryClient, activeInstanceId);

  const markResultMutation = useMutation({
    mutationFn: async ({
      index,
      slotId,
      value,
    }: {
      index: number;
      slotId: string;
      value: ResultValue;
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      await recordGenericResult(activeInstanceId, index, slotId, value);
    },
    onMutate: ({ index, slotId, value }) =>
      snapshotAndUpdate((prev) => ({
        ...prev,
        results: setSlotResultOptimistic(prev.results, index, slotId, value),
      })),
    onError: detailOnError,
    onSettled: detailOnSettled,
  });

  const setAmrapMutation = useMutation({
    mutationFn: async ({
      index,
      slotId,
      reps,
    }: {
      index: number;
      slotId: string;
      reps: number | undefined;
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      const currentResult = results[String(index)]?.[slotId]?.result;
      if (!currentResult) return;
      await recordGenericResult(activeInstanceId, index, slotId, currentResult, reps);
    },
    onMutate: ({ index, slotId, reps }) =>
      snapshotAndUpdate((prev) => {
        const key = String(index);
        const updatedResults = { ...prev.results };
        const workoutEntry = { ...updatedResults[key] };
        const slotEntry = { ...workoutEntry[slotId] };
        if (reps === undefined) {
          delete slotEntry.amrapReps;
        } else {
          slotEntry.amrapReps = reps;
        }
        workoutEntry[slotId] = slotEntry;
        updatedResults[key] = workoutEntry;
        return { ...prev, results: updatedResults };
      }),
    onError: detailOnError,
    // onSettled omitted — setAmrapRepsCb updates the cache directly (immediate setQueryData +
    // debounced mutate); invalidating here would trigger a redundant GET on every click.
  });

  const setRpeMutation = useMutation({
    mutationFn: async ({
      index,
      slotId,
      rpe,
    }: {
      index: number;
      slotId: string;
      rpe: number | undefined;
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      const currentResult = results[String(index)]?.[slotId]?.result;
      if (!currentResult) return;
      const amrapReps = results[String(index)]?.[slotId]?.amrapReps;
      await recordGenericResult(activeInstanceId, index, slotId, currentResult, amrapReps, rpe);
    },
    onMutate: ({ index, slotId, rpe }) =>
      snapshotAndUpdate((prev) => {
        const key = String(index);
        const updatedResults = { ...prev.results };
        const workoutEntry = { ...updatedResults[key] };
        const slotEntry = { ...workoutEntry[slotId] };
        if (rpe === undefined) {
          delete slotEntry.rpe;
        } else {
          slotEntry.rpe = rpe;
        }
        workoutEntry[slotId] = slotEntry;
        updatedResults[key] = workoutEntry;
        return { ...prev, results: updatedResults };
      }),
    onError: detailOnError,
    // onSettled omitted — setRpeCb updates the cache directly (immediate setQueryData +
    // debounced mutate); invalidating here would trigger a redundant GET on every selection.
  });

  const undoSpecificMutation = useMutation({
    mutationFn: async ({ index, slotId }: { index: number; slotId: string }) => {
      if (!activeInstanceId) throw new Error('No active program');
      await deleteGenericResult(activeInstanceId, index, slotId);
    },
    onMutate: ({ index, slotId }) =>
      snapshotAndUpdate((prev) => ({
        ...prev,
        results: removeSlotResult(prev.results, index, slotId),
      })),
    onError: detailOnError,
    onSettled: detailOnSettled,
  });

  const undoLastMutation = useMutation({
    mutationFn: async () => {
      if (!activeInstanceId) throw new Error('No active program');
      await undoLastResult(activeInstanceId);
    },
    onError: () => {
      toast({ message: 'No se pudo deshacer. Inténtalo de nuevo.' });
    },
    onSettled: detailOnSettled,
  });

  const generateProgramMutation = useMutation({
    mutationFn: async (newConfig: Record<string, number | string>) => {
      if (!definition) throw new Error('Unknown program definition');
      await createProgram(programId, definition.name, newConfig);
    },
    onError: () => {
      toast({ message: 'No se pudo crear el programa. Inténtalo de nuevo.' });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: Record<string, number | string>) => {
      if (!activeInstanceId) throw new Error('No active program');
      await updateProgramConfig(activeInstanceId, newConfig);
    },
    onError: () => {
      toast({ message: 'No se pudo actualizar la configuración. Inténtalo de nuevo.' });
    },
    onSettled: detailOnSettled,
  });

  const updateMetadataMutation = useMutation({
    mutationFn: async (newMetadata: Record<string, unknown>) => {
      if (!activeInstanceId) throw new Error('No active program');
      await updateProgramMetadata(activeInstanceId, newMetadata);
    },
    onMutate: (newMetadata) =>
      snapshotAndUpdate((prev) => ({
        ...prev,
        metadata: {
          ...(isRecord(prev.metadata) ? prev.metadata : {}),
          ...newMetadata,
        },
      })),
    onError: detailOnError,
    onSettled: detailOnSettled,
  });

  const finishProgramMutation = useMutation({
    mutationFn: async () => {
      if (!activeInstanceId) throw new Error('No active program');
      await completeProgram(activeInstanceId);
    },
    onSuccess: () => {
      // Optimistically mark this instance as completed in the list cache so the
      // dashboard immediately shows enabled catalog cards when we navigate back.
      const idToComplete = activeInstanceId;
      if (idToComplete) {
        queryClient.setQueryData<ProgramSummary[]>(
          queryKeys.programs.all,
          (prev: ProgramSummary[] | undefined) => {
            if (!prev) return prev;
            return prev.map((p: ProgramSummary) =>
              p.id === idToComplete ? { ...p, status: 'completed' } : p
            );
          }
        );
      }
    },
    onError: () => {
      toast({ message: 'No se pudo finalizar el programa. Inténtalo de nuevo.' });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      // Clean up the detail cache so stale 'active' status can't be served
      if (activeInstanceId) {
        queryClient.removeQueries({ queryKey: queryKeys.programs.detail(activeInstanceId) });
      }
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      if (!activeInstanceId) throw new Error('No active program');
      await deleteProgram(activeInstanceId);
    },
    onError: () => {
      toast({ message: 'No se pudo reiniciar el programa. Inténtalo de nuevo.' });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
    },
  });

  // -------------------------------------------------------------------------
  // Stable callbacks
  // -------------------------------------------------------------------------

  const markResultCb = (index: number, slotId: string, value: ResultValue): void => {
    markResultMutation.mutate({ index, slotId, value });
  };

  /** Patch a single field on a slot entry in the cached program detail. */
  const patchSlotField = (
    index: number,
    slotId: string,
    field: 'amrapReps' | 'rpe',
    value: number | undefined
  ): void => {
    const detailKey = queryKeys.programs.detail(activeInstanceId ?? '');
    queryClient.setQueryData<GenericProgramDetail>(detailKey, (prev) => {
      if (!prev) return prev;
      const key = String(index);
      const updatedResults = { ...prev.results };
      const workoutEntry = { ...updatedResults[key] };
      const slotEntry = { ...workoutEntry[slotId] };
      if (value === undefined) {
        delete slotEntry[field];
      } else {
        slotEntry[field] = value;
      }
      workoutEntry[slotId] = slotEntry;
      updatedResults[key] = workoutEntry;
      return { ...prev, results: updatedResults };
    });
  };

  const setAmrapRepsCb = (index: number, slotId: string, reps: number | undefined): void => {
    patchSlotField(index, slotId, 'amrapReps', reps);

    // Debounce the API call: rapid clicks on +/- coalesce into a single POST.
    const timerKey = `${index}-${slotId}`;
    const existing = amrapTimers.current.get(timerKey);
    if (existing !== undefined) clearTimeout(existing);
    amrapTimers.current.set(
      timerKey,
      setTimeout(() => {
        amrapTimers.current.delete(timerKey);
        setAmrapMutation.mutate({ index, slotId, reps });
      }, 400)
    );
  };

  const setRpeCb = (index: number, slotId: string, rpe: number | undefined): void => {
    patchSlotField(index, slotId, 'rpe', rpe);

    // Debounce: switching RPE values rapidly fires one POST after 300ms.
    const timerKey = `${index}-${slotId}-rpe`;
    const existing = rpeTimers.current.get(timerKey);
    if (existing !== undefined) clearTimeout(existing);
    rpeTimers.current.set(
      timerKey,
      setTimeout(() => {
        rpeTimers.current.delete(timerKey);
        setRpeMutation.mutate({ index, slotId, rpe });
      }, 300)
    );
  };

  const undoSpecificCb = (index: number, slotId: string): void => {
    undoSpecificMutation.mutate({ index, slotId });
  };

  const undoLastCb = (): void => {
    undoLastMutation.mutate();
  };

  const generateProgramCb = async (newConfig: Record<string, number | string>): Promise<void> => {
    await generateProgramMutation.mutateAsync(newConfig);
  };

  const updateConfigCb = (newConfig: Record<string, number | string>): void => {
    updateConfigMutation.mutate(newConfig);
  };

  const updateMetadataCb = (newMetadata: Record<string, unknown>): void => {
    updateMetadataMutation.mutate(newMetadata);
  };

  const finishProgramCb = async (): Promise<void> => {
    await finishProgramMutation.mutateAsync();
  };

  const resetAllCb = (onSuccess?: () => void): void => {
    // Capture the instanceId at call-time: by the time onSuccess fires, the
    // activeInstanceId closure may already have flipped to null.
    const idToRemove = activeInstanceId;
    resetAllMutation.mutate(undefined, {
      onSuccess: () => {
        // Remove the stale detail cache so the setup form shows immediately.
        // Disabling a query (enabled: false) keeps cached data alive — evict it.
        if (idToRemove) {
          queryClient.removeQueries({ queryKey: queryKeys.programs.detail(idToRemove) });
        }
        onSuccess?.();
      },
    });
  };

  const exportDataCb = async (): Promise<void> => {
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
      console.error('[program] Export failed:', err instanceof Error ? err.message : err);
      toast({ message: 'No se pudo exportar el programa.' });
    }
  };

  const importDataCb = async (json: string): Promise<boolean> => {
    try {
      const parsed: unknown = JSON.parse(json);
      await importProgram(parsed);
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
      return true;
    } catch (err: unknown) {
      console.error('[program] Import failed:', err instanceof Error ? err.message : err);
      toast({
        message: 'No se pudo importar el programa. Verifica el archivo e inténtalo de nuevo.',
      });
      return false;
    }
  };

  return {
    definition,
    config,
    metadata,
    rows,
    undoHistory,
    resultTimestamps,
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
  };
}
