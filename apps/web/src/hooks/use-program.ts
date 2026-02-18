import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
// Hook interface
// ---------------------------------------------------------------------------

interface UseProgramReturn {
  readonly startWeights: StartWeights | null;
  readonly results: Results;
  readonly undoHistory: UndoHistory;
  readonly isLoading: boolean;
  readonly activeInstanceId: string | null;
  readonly generateProgram: (weights: StartWeights) => void;
  readonly updateWeights: (weights: StartWeights) => void;
  readonly markResult: (index: number, tier: Tier, value: ResultValue) => void;
  readonly setAmrapReps: (
    index: number,
    field: 't1Reps' | 't3Reps',
    reps: number | undefined
  ) => void;
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
  const { user } = useAuth();

  // Fetch the list of programs to find the active one
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null,
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
  });

  const detail = detailQuery.data ?? null;
  const startWeights = detail?.startWeights ?? null;
  const results = detail?.results ?? {};
  const undoHistory = detail?.undoHistory ?? [];
  const isLoading = programsQuery.isLoading || detailQuery.isLoading;

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

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
    onMutate: async ({ index, tier, value }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });

      // Snapshot previous value
      const previousDetail = queryClient.getQueryData<ProgramDetail>(
        queryKeys.programs.detail(activeInstanceId ?? '')
      );

      // Optimistically update the cached detail
      if (previousDetail) {
        queryClient.setQueryData<ProgramDetail>(queryKeys.programs.detail(activeInstanceId ?? ''), {
          ...previousDetail,
          results: setResultOptimistic(previousDetail.results, index, tier, value),
        });
      }

      return { previousDetail };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.programs.detail(activeInstanceId ?? ''),
          context.previousDetail
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });
    },
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

      // Record the result with amrapReps — need the current result value
      const currentResult = results[index]?.[tier];
      if (!currentResult) return; // No result to attach AMRAP to

      await recordResult(activeInstanceId, index, tier, currentResult, reps);
    },
    onMutate: async ({ index, field, reps }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });

      const previousDetail = queryClient.getQueryData<ProgramDetail>(
        queryKeys.programs.detail(activeInstanceId ?? '')
      );

      if (previousDetail) {
        const updatedResults = { ...previousDetail.results };
        const entry = { ...updatedResults[index] };
        if (reps === undefined) {
          delete entry[field];
        } else {
          entry[field] = reps;
        }
        updatedResults[index] = entry;

        queryClient.setQueryData<ProgramDetail>(queryKeys.programs.detail(activeInstanceId ?? ''), {
          ...previousDetail,
          results: updatedResults,
        });
      }

      return { previousDetail };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.programs.detail(activeInstanceId ?? ''),
          context.previousDetail
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });
    },
  });

  const undoSpecificMutation = useMutation({
    mutationFn: async ({ index, tier }: { index: number; tier: Tier }) => {
      if (!activeInstanceId) throw new Error('No active program');
      await deleteResult(activeInstanceId, index, tier);
    },
    onMutate: async ({ index, tier }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });

      const previousDetail = queryClient.getQueryData<ProgramDetail>(
        queryKeys.programs.detail(activeInstanceId ?? '')
      );

      if (previousDetail) {
        queryClient.setQueryData<ProgramDetail>(queryKeys.programs.detail(activeInstanceId ?? ''), {
          ...previousDetail,
          results: removeTierResult(previousDetail.results, index, tier),
        });
      }

      return { previousDetail };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.programs.detail(activeInstanceId ?? ''),
          context.previousDetail
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });
    },
  });

  const undoLastMutation = useMutation({
    mutationFn: async () => {
      if (!activeInstanceId) throw new Error('No active program');
      await undoLastResult(activeInstanceId);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });
    },
  });

  const generateProgramMutation = useMutation({
    mutationFn: async (weights: StartWeights) => {
      await createProgram('gzclp', 'GZCLP', weights);
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
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });
    },
  });

  const resetAllMutation = useMutation({
    mutationFn: async () => {
      if (!activeInstanceId) throw new Error('No active program');
      await deleteProgram(activeInstanceId);
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
      setAmrapMutation.mutate({ index, field, reps });
    },
    [setAmrapMutation]
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
    (weights: StartWeights): void => {
      generateProgramMutation.mutate(weights);
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
      } catch (err: unknown) {
        console.warn('Import failed:', err instanceof Error ? err.message : 'Unknown error');
        return false;
      }
    },
    [queryClient]
  );

  return {
    startWeights,
    results,
    undoHistory,
    isLoading,
    activeInstanceId,
    generateProgram: generateProgramCb,
    updateWeights: updateWeightsCb,
    markResult: markResultCb,
    setAmrapReps: setAmrapRepsCb,
    undoSpecific: undoSpecificCb,
    undoLast: undoLastCb,
    resetAll: resetAllCb,
    exportData: exportDataCb,
    importData: importDataCb,
  };
}
