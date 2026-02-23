import { useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { StartWeights, Results, UndoHistory, Tier, ResultValue } from '@gzclp/shared/types';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchPrograms,
  fetchProgram,
  createProgram,
  updateProgramConfig,
  deleteProgram,
  recordResult,
  deleteResult,
  undoLastResult,
  exportProgram,
  importProgram,
  type ProgramDetail,
} from '@/lib/api-functions';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';

// ---------------------------------------------------------------------------
// Helper: optimistic update for results
// ---------------------------------------------------------------------------

function setResultOptimistic(
  prev: Results,
  index: number,
  tier: Tier,
  value: ResultValue
): Results {
  return {
    ...prev,
    [index]: { ...prev[index], [tier]: value },
  };
}

function removeTierResult(results: Results, index: number, tier: Tier): Results {
  const updated = { ...results };
  if (updated[index]) {
    const entry = { ...updated[index] };
    delete entry[tier];
    if (Object.keys(entry).length === 0) {
      delete updated[index];
    } else {
      updated[index] = entry;
    }
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Helper: shared optimistic mutation lifecycle callbacks
// ---------------------------------------------------------------------------

interface OptimisticContext {
  readonly previousDetail: ProgramDetail | undefined;
}

/** Creates onMutate/onError/onSettled handlers for detail cache optimistic updates. */
function optimisticDetailCallbacks(
  queryClient: QueryClient,
  instanceId: string | null
): {
  snapshotAndUpdate: (
    updater: (prev: ProgramDetail) => ProgramDetail
  ) => Promise<OptimisticContext>;
  onError: (_err: unknown, _vars: unknown, context: OptimisticContext | undefined) => void;
  onSettled: () => void;
} {
  const detailKey = queryKeys.programs.detail(instanceId ?? '');

  return {
    snapshotAndUpdate: async (updater) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previousDetail = queryClient.getQueryData<ProgramDetail>(detailKey);
      if (previousDetail) {
        queryClient.setQueryData<ProgramDetail>(detailKey, updater(previousDetail));
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

interface UseProgramReturn {
  readonly startWeights: StartWeights | null;
  readonly results: Results;
  readonly undoHistory: UndoHistory;
  readonly resultTimestamps: Readonly<Record<string, string>>;
  readonly isLoading: boolean;
  readonly isGenerating: boolean;
  readonly activeInstanceId: string | null;
  readonly generateProgram: (weights: StartWeights) => Promise<void>;
  readonly updateWeights: (weights: StartWeights) => void;
  readonly markResult: (index: number, tier: Tier, value: ResultValue) => void;
  readonly setAmrapReps: (
    index: number,
    field: 't1Reps' | 't3Reps',
    reps: number | undefined
  ) => void;
  readonly setRpe: (index: number, tier: 't1' | 't3', rpe: number | undefined) => void;
  readonly undoSpecific: (index: number, tier: Tier) => void;
  readonly undoLast: () => void;
  readonly resetAll: () => void;
  readonly exportData: () => void;
  readonly importData: (json: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useProgram(instanceId?: string): UseProgramReturn {
  const queryClient = useQueryClient();
  const { user, isGuest } = useAuth();
  const { toast } = useToast();

  // Fetch the list of programs to find the active one (disabled for guest users)
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
  });

  // Use provided instanceId directly, or fall back to first active program
  const activeInstanceId = useMemo(() => {
    if (instanceId) return instanceId;
    if (!programsQuery.data) return null;
    return programsQuery.data.find((p) => p.status === 'active')?.id ?? null;
  }, [instanceId, programsQuery.data]);

  // Fetch the full program detail (results + undo)
  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
    queryFn: () => fetchProgram(activeInstanceId ?? ''),
    enabled: activeInstanceId !== null,
    staleTime: 10_000,
  });

  const detail = detailQuery.data ?? null;
  const startWeights = detail?.startWeights ?? null;
  const results = detail?.results ?? {};
  const undoHistory = detail?.undoHistory ?? [];
  const resultTimestamps = detail?.resultTimestamps ?? {};
  const isLoading = programsQuery.isLoading || detailQuery.isLoading;

  // Per-key debounce timers for high-frequency mutations (AMRAP, RPE).
  // Key format: `${workoutIndex}-${field}` — each unique field has its own timer.
  const amrapTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const rpeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
      tier,
      value,
    }: {
      index: number;
      tier: Tier;
      value: ResultValue;
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      await recordResult(activeInstanceId, index, tier, value);
    },
    onMutate: ({ index, tier, value }) =>
      snapshotAndUpdate((prev) => ({
        ...prev,
        results: setResultOptimistic(prev.results, index, tier, value),
      })),
    onError: detailOnError,
    onSettled: detailOnSettled,
  });

  const setAmrapMutation = useMutation({
    mutationFn: async ({
      index,
      field,
      reps,
    }: {
      index: number;
      field: 't1Reps' | 't3Reps';
      reps: number | undefined;
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      const tier: Tier = field === 't1Reps' ? 't1' : 't3';
      const currentResult = results[index]?.[tier];
      if (!currentResult) return;
      await recordResult(activeInstanceId, index, tier, currentResult, reps);
    },
    onMutate: ({ index, field, reps }) =>
      snapshotAndUpdate((prev) => {
        const updatedResults = { ...prev.results };
        const entry = { ...updatedResults[index] };
        if (reps === undefined) {
          delete entry[field];
        } else {
          entry[field] = reps;
        }
        updatedResults[index] = entry;
        return { ...prev, results: updatedResults };
      }),
    onError: detailOnError,
    onSettled: detailOnSettled,
  });

  // fix: setRpe now accepts a tier parameter for independent T1/T3 RPE
  const setRpeMutation = useMutation({
    mutationFn: async ({
      index,
      tier,
      rpe,
    }: {
      index: number;
      tier: 't1' | 't3';
      rpe: number | undefined;
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      const currentResult = results[index]?.[tier];
      if (!currentResult) return;
      const amrapReps = tier === 't1' ? results[index]?.t1Reps : results[index]?.t3Reps;
      await recordResult(activeInstanceId, index, tier, currentResult, amrapReps, rpe);
    },
    onMutate: ({ index, tier, rpe }) =>
      snapshotAndUpdate((prev) => {
        const updatedResults = { ...prev.results };
        const entry = { ...updatedResults[index] };
        const field = tier === 't1' ? 'rpe' : 't3Rpe';
        if (rpe === undefined) {
          delete entry[field];
        } else {
          entry[field] = rpe;
        }
        updatedResults[index] = entry;
        return { ...prev, results: updatedResults };
      }),
    onError: detailOnError,
    onSettled: detailOnSettled,
  });

  const undoSpecificMutation = useMutation({
    mutationFn: async ({ index, tier }: { index: number; tier: Tier }) => {
      if (!activeInstanceId) throw new Error('No active program');
      await deleteResult(activeInstanceId, index, tier);
    },
    onMutate: ({ index, tier }) =>
      snapshotAndUpdate((prev) => ({
        ...prev,
        results: removeTierResult(prev.results, index, tier),
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
    mutationFn: async (weights: StartWeights) => {
      await createProgram('gzclp', 'GZCLP', weights);
    },
    onError: () => {
      toast({ message: 'No se pudo crear el programa. Inténtalo de nuevo.' });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
    },
  });

  const updateWeightsMutation = useMutation({
    mutationFn: async (weights: StartWeights) => {
      if (!activeInstanceId) throw new Error('No active program');
      await updateProgramConfig(activeInstanceId, weights);
    },
    onError: () => {
      toast({ message: 'No se pudieron actualizar los pesos. Inténtalo de nuevo.' });
    },
    onSettled: detailOnSettled,
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

  const markResultCb = useCallback(
    (index: number, tier: Tier, value: ResultValue): void => {
      markResultMutation.mutate({ index, tier, value });
    },
    [markResultMutation]
  );

  const setAmrapRepsCb = useCallback(
    (index: number, field: 't1Reps' | 't3Reps', reps: number | undefined): void => {
      // Immediately reflect the change in the cache so the UI feels snappy.
      const detailKey = queryKeys.programs.detail(activeInstanceId ?? '');
      queryClient.setQueryData<ProgramDetail>(detailKey, (prev) => {
        if (!prev) return prev;
        const updatedResults = { ...prev.results };
        const entry = { ...updatedResults[index] };
        if (reps === undefined) {
          delete entry[field];
        } else {
          entry[field] = reps;
        }
        updatedResults[index] = entry;
        return { ...prev, results: updatedResults };
      });

      // Debounce the API call: rapid clicks on +/- coalesce into a single POST.
      const timerKey = `${index}-${field}`;
      const existing = amrapTimers.current.get(timerKey);
      if (existing !== undefined) clearTimeout(existing);
      amrapTimers.current.set(
        timerKey,
        setTimeout(() => {
          amrapTimers.current.delete(timerKey);
          setAmrapMutation.mutate({ index, field, reps });
        }, 400)
      );
    },
    [queryClient, activeInstanceId, setAmrapMutation]
  );

  const setRpeCb = useCallback(
    (index: number, tier: 't1' | 't3', rpe: number | undefined): void => {
      // Immediately reflect the change in the cache.
      const detailKey = queryKeys.programs.detail(activeInstanceId ?? '');
      queryClient.setQueryData<ProgramDetail>(detailKey, (prev) => {
        if (!prev) return prev;
        const updatedResults = { ...prev.results };
        const entry = { ...updatedResults[index] };
        const field = tier === 't1' ? ('rpe' as const) : ('t3Rpe' as const);
        if (rpe === undefined) {
          delete entry[field];
        } else {
          entry[field] = rpe;
        }
        updatedResults[index] = entry;
        return { ...prev, results: updatedResults };
      });

      // Debounce: switching RPE values rapidly fires one POST after 300ms.
      const timerKey = `${index}-${tier}-rpe`;
      const existing = rpeTimers.current.get(timerKey);
      if (existing !== undefined) clearTimeout(existing);
      rpeTimers.current.set(
        timerKey,
        setTimeout(() => {
          rpeTimers.current.delete(timerKey);
          setRpeMutation.mutate({ index, tier, rpe });
        }, 300)
      );
    },
    [queryClient, activeInstanceId, setRpeMutation]
  );

  const undoSpecificCb = useCallback(
    (index: number, tier: Tier): void => {
      undoSpecificMutation.mutate({ index, tier });
    },
    [undoSpecificMutation]
  );

  const undoLastCb = useCallback((): void => {
    undoLastMutation.mutate();
  }, [undoLastMutation]);

  const generateProgramCb = useCallback(
    async (weights: StartWeights): Promise<void> => {
      await generateProgramMutation.mutateAsync(weights);
    },
    [generateProgramMutation]
  );

  const updateWeightsCb = useCallback(
    (weights: StartWeights): void => {
      updateWeightsMutation.mutate(weights);
    },
    [updateWeightsMutation]
  );

  const resetAllCb = useCallback((): void => {
    resetAllMutation.mutate();
  }, [resetAllMutation]);

  const exportDataCb = useCallback((): void => {
    if (!activeInstanceId) return;
    void exportProgram(activeInstanceId).then((data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gzclp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, [activeInstanceId]);

  const importDataCb = useCallback(
    async (json: string): Promise<boolean> => {
      try {
        const parsed: unknown = JSON.parse(json);
        await importProgram(parsed);
        void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
        return true;
      } catch {
        toast({
          message: 'No se pudo importar el programa. Verifica el archivo e inténtalo de nuevo.',
        });
        return false;
      }
    },
    [queryClient, toast]
  );

  return {
    startWeights,
    results,
    undoHistory,
    resultTimestamps,
    isLoading,
    isGenerating: generateProgramMutation.isPending,
    activeInstanceId,
    generateProgram: generateProgramCb,
    updateWeights: updateWeightsCb,
    markResult: markResultCb,
    setAmrapReps: setAmrapRepsCb,
    setRpe: setRpeCb,
    undoSpecific: undoSpecificCb,
    undoLast: undoLastCb,
    resetAll: resetAllCb,
    exportData: exportDataCb,
    importData: importDataCb,
  };
}
