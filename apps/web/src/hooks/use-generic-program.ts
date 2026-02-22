import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getProgramDefinition } from '@gzclp/shared/programs/registry';
import { computeGenericProgram } from '@gzclp/shared/generic-engine';
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
  createProgram,
  updateProgramConfig,
  deleteProgram,
  recordGenericResult,
  deleteGenericResult,
  undoLastResult,
  exportProgram,
  importProgram,
  type GenericProgramDetail,
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

export interface UseGenericProgramReturn {
  readonly definition: ProgramDefinition | undefined;
  readonly config: Record<string, number> | null;
  readonly rows: readonly GenericWorkoutRow[];
  readonly undoHistory: GenericUndoHistory;
  readonly isLoading: boolean;
  readonly isGenerating: boolean;
  readonly activeInstanceId: string | null;
  readonly generateProgram: (config: Record<string, number>) => Promise<void>;
  readonly updateConfig: (config: Record<string, number>) => void;
  readonly markResult: (index: number, slotId: string, value: ResultValue) => void;
  readonly setAmrapReps: (index: number, slotId: string, reps: number | undefined) => void;
  readonly setRpe: (index: number, slotId: string, rpe: number | undefined) => void;
  readonly undoSpecific: (index: number, slotId: string) => void;
  readonly undoLast: () => void;
  readonly resetAll: () => void;
  readonly exportData: () => void;
  readonly importData: (json: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useGenericProgram(programId: string, instanceId?: string): UseGenericProgramReturn {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const definition = useMemo(() => getProgramDefinition(programId), [programId]);

  // Fetch the list of programs to find the active one
  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null,
  });

  // Use provided instanceId, or find active instance with matching programId
  const activeInstanceId = useMemo(() => {
    if (instanceId) return instanceId;
    if (!programsQuery.data) return null;
    return (
      programsQuery.data.find((p) => p.status === 'active' && p.programId === programId)?.id ?? null
    );
  }, [instanceId, programsQuery.data, programId]);

  // Fetch the full program detail in generic format
  const detailQuery = useQuery({
    queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
    queryFn: () => fetchGenericProgramDetail(activeInstanceId ?? ''),
    enabled: activeInstanceId !== null,
  });

  const detail = detailQuery.data ?? null;
  const config = detail?.config ?? null;
  const results: GenericResults = detail?.results ?? {};
  const undoHistory: GenericUndoHistory = detail?.undoHistory ?? [];
  const isLoading = programsQuery.isLoading || detailQuery.isLoading;

  // Compute rows from definition + config + results
  const rows = useMemo((): readonly GenericWorkoutRow[] => {
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
    onSettled: detailOnSettled,
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
    onSettled: detailOnSettled,
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
    mutationFn: async (newConfig: Record<string, number>) => {
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
    mutationFn: async (newConfig: Record<string, number>) => {
      if (!activeInstanceId) throw new Error('No active program');
      await updateProgramConfig(activeInstanceId, newConfig);
    },
    onError: () => {
      toast({ message: 'No se pudo actualizar la configuración. Inténtalo de nuevo.' });
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
    (index: number, slotId: string, value: ResultValue): void => {
      markResultMutation.mutate({ index, slotId, value });
    },
    [markResultMutation]
  );

  const setAmrapRepsCb = useCallback(
    (index: number, slotId: string, reps: number | undefined): void => {
      setAmrapMutation.mutate({ index, slotId, reps });
    },
    [setAmrapMutation]
  );

  const setRpeCb = useCallback(
    (index: number, slotId: string, rpe: number | undefined): void => {
      setRpeMutation.mutate({ index, slotId, rpe });
    },
    [setRpeMutation]
  );

  const undoSpecificCb = useCallback(
    (index: number, slotId: string): void => {
      undoSpecificMutation.mutate({ index, slotId });
    },
    [undoSpecificMutation]
  );

  const undoLastCb = useCallback((): void => {
    undoLastMutation.mutate();
  }, [undoLastMutation]);

  const generateProgramCb = useCallback(
    async (newConfig: Record<string, number>): Promise<void> => {
      await generateProgramMutation.mutateAsync(newConfig);
    },
    [generateProgramMutation]
  );

  const updateConfigCb = useCallback(
    (newConfig: Record<string, number>): void => {
      updateConfigMutation.mutate(newConfig);
    },
    [updateConfigMutation]
  );

  const resetAllCb = useCallback((): void => {
    resetAllMutation.mutate();
  }, [resetAllMutation]);

  const exportDataCb = useCallback((): void => {
    if (!activeInstanceId) return;
    void exportProgram(activeInstanceId).then((data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${programId}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }, [activeInstanceId, programId]);

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
    definition,
    config,
    rows,
    undoHistory,
    isLoading,
    isGenerating: generateProgramMutation.isPending,
    activeInstanceId,
    generateProgram: generateProgramCb,
    updateConfig: updateConfigCb,
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
