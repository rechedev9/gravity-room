import { useMutation, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { ProgramDefinition, GenericResults } from '@gzclp/domain/types/program';
import type { ResultValue, SetLogEntry } from '@gzclp/domain/types';
import { queryKeys } from '@/lib/query-keys';
import {
  createProgram,
  updateProgramConfig,
  updateProgramMetadata,
  completeProgram,
  deleteProgram,
  recordGenericResult,
  deleteGenericResult,
  undoLastResult,
  type GenericProgramDetail,
  type ProgramSummary,
} from '@/lib/api-functions';
import { trackEvent } from '@/lib/analytics';
import { isRecord } from '@gzclp/domain/type-guards';
import {
  setSlotResult as setSlotResultOptimistic,
  removeSlotResult,
  patchSlotField,
} from '@/lib/slot-result-helpers';
import type { GenericUndoHistory } from '@gzclp/domain/types/program';

// ---------------------------------------------------------------------------
// Optimistic undo-last reconstruction
// ---------------------------------------------------------------------------

/**
 * Replicate the server's `undoLast` (results.ts) on the cached results so the
 * UI reverts instantly instead of waiting for the round-trip. The undo stack is
 * ordered ascending by id, so the last entry is the LIFO top the server pops.
 * `prev === undefined` mirrors `previousResult === null` (the slot had no result
 * before → delete it); otherwise restore the snapshot exactly. onSettled
 * reconciles against the server afterward.
 */
function applyUndoLast(results: GenericResults, undoHistory: GenericUndoHistory): GenericResults {
  const top = undoHistory[undoHistory.length - 1];
  if (!top) return results;
  if (top.prev === undefined) {
    return removeSlotResult(results, top.i, top.slotId);
  }
  // Clear the current slot first so stale amrapReps/rpe/setLogs from the action
  // being undone don't linger, then write the previous snapshot verbatim.
  const cleared = removeSlotResult(results, top.i, top.slotId);
  let restored = setSlotResultOptimistic(
    cleared,
    top.i,
    top.slotId,
    top.prev,
    top.prevAmrapReps,
    top.prevSetLogs
  );
  if (top.prevRpe !== undefined) {
    restored = patchSlotField(restored, top.i, top.slotId, 'rpe', top.prevRpe);
  }
  return restored;
}

// ---------------------------------------------------------------------------
// Shared optimistic mutation lifecycle callbacks
// ---------------------------------------------------------------------------

interface OptimisticContext {
  readonly previousDetail: GenericProgramDetail | undefined;
}

/**
 * Roll a single result field back to `previousValue`, but only if the field
 * still holds the value this (failed) mutation optimistically wrote. If it
 * doesn't, a newer edit already landed on top of it while this request was
 * in flight — that edit (and its own mutation) now owns the field, so a
 * stale rollback here would clobber it. This is what makes the AMRAP/RPE
 * rollback safe without onSettled invalidation (see the mutations below).
 */
function rollbackFieldIfUnchanged(
  queryClient: QueryClient,
  detailKey: QueryKey,
  index: number,
  slotId: string,
  field: 'amrapReps' | 'rpe',
  attemptedValue: number | undefined,
  previousValue: number | undefined
): void {
  const current = queryClient.getQueryData<GenericProgramDetail>(detailKey);
  if (!current) return;
  const currentValue = current.results[String(index)]?.[slotId]?.[field];
  if (currentValue !== attemptedValue) return;
  queryClient.setQueryData<GenericProgramDetail>(detailKey, {
    ...current,
    results: patchSlotField(current.results, index, slotId, field, previousValue),
  });
}

const RESULT_RECONCILIATION_DELAY_MS = 2000;
const reconciliationTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleDetailReconciliation(queryClient: QueryClient, detailKey: QueryKey) {
  const timerKey = JSON.stringify(detailKey);
  const existingTimer = reconciliationTimers.get(timerKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  reconciliationTimers.set(
    timerKey,
    setTimeout(() => {
      reconciliationTimers.delete(timerKey);
      void queryClient.invalidateQueries({ queryKey: detailKey });
    }, RESULT_RECONCILIATION_DELAY_MS)
  );
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
  onSettledAfterResultIdle: () => void;
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
    onSettledAfterResultIdle: () => {
      scheduleDetailReconciliation(queryClient, detailKey);
    },
  };
}

// ---------------------------------------------------------------------------
// Hook parameters
// ---------------------------------------------------------------------------

export interface UseProgramMutationsParams {
  readonly activeInstanceId: string | null;
  readonly programId: string;
  readonly definition: ProgramDefinition | undefined;
  readonly queryClient: QueryClient;
  readonly toast: (options: { message: string }) => void;
  readonly t: (key: string) => string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProgramMutations({
  activeInstanceId,
  programId,
  definition,
  queryClient,
  toast,
  t,
}: UseProgramMutationsParams) {
  const {
    snapshotAndUpdate,
    onError: detailOnError,
    onSettled: detailOnSettled,
    onSettledAfterResultIdle,
  } = optimisticDetailCallbacks(queryClient, activeInstanceId);

  const markResultMutation = useMutation({
    mutationFn: async ({
      index,
      slotId,
      value,
      setLogs,
    }: {
      index: number;
      slotId: string;
      value: ResultValue;
      setLogs?: readonly SetLogEntry[];
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      await recordGenericResult(
        activeInstanceId,
        index,
        slotId,
        value,
        undefined,
        undefined,
        setLogs
      );
    },
    onMutate: ({ index, slotId, value, setLogs }) =>
      snapshotAndUpdate((prev) => ({
        ...prev,
        results: setSlotResultOptimistic(prev.results, index, slotId, value, undefined, setLogs),
      })),
    onError: detailOnError,
    onSettled: onSettledAfterResultIdle,
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
      previousReps: number | undefined;
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      // Read current results fresh from the cache to avoid stale closure
      const cached = queryClient.getQueryData<GenericProgramDetail>(
        queryKeys.programs.detail(activeInstanceId)
      );
      const results: GenericResults = cached?.results ?? {};
      const currentResult = results[String(index)]?.[slotId]?.result;
      if (!currentResult) return;
      await recordGenericResult(activeInstanceId, index, slotId, currentResult, reps);
    },
    // No onMutate optimistic write here: setAmrapRepsCb already patched the cache
    // synchronously (before the debounce), and it captured the true pre-session
    // value as `previousReps` — that's what onError below restores to. We only
    // need to stop an in-flight GET from clobbering that optimistic value.
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });
    },
    onError: (_err, vars) => {
      rollbackFieldIfUnchanged(
        queryClient,
        queryKeys.programs.detail(activeInstanceId ?? ''),
        vars.index,
        vars.slotId,
        'amrapReps',
        vars.reps,
        vars.previousReps
      );
      toast({ message: t('tracker.errors.amrap_save_failed') });
    },
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
      previousRpe: number | undefined;
    }) => {
      if (!activeInstanceId) throw new Error('No active program');
      // Read current results fresh from the cache to avoid stale closure
      const cached = queryClient.getQueryData<GenericProgramDetail>(
        queryKeys.programs.detail(activeInstanceId)
      );
      const results: GenericResults = cached?.results ?? {};
      const currentResult = results[String(index)]?.[slotId]?.result;
      if (!currentResult) return;
      const amrapReps = results[String(index)]?.[slotId]?.amrapReps;
      await recordGenericResult(activeInstanceId, index, slotId, currentResult, amrapReps, rpe);
    },
    // Same rationale as setAmrapMutation above: the cache is already patched
    // synchronously by setRpeCb; only cancel in-flight GETs here.
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.programs.detail(activeInstanceId ?? ''),
      });
    },
    onError: (_err, vars) => {
      rollbackFieldIfUnchanged(
        queryClient,
        queryKeys.programs.detail(activeInstanceId ?? ''),
        vars.index,
        vars.slotId,
        'rpe',
        vars.rpe,
        vars.previousRpe
      );
      toast({ message: t('tracker.errors.rpe_save_failed') });
    },
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
    onMutate: () =>
      snapshotAndUpdate((prev) => ({
        ...prev,
        results: applyUndoLast(prev.results, prev.undoHistory),
        undoHistory: prev.undoHistory.slice(0, -1),
      })),
    onError: (err, vars, ctx) => {
      detailOnError(err, vars, ctx);
      toast({ message: t('tracker.errors.undo_failed') });
    },
    onSettled: detailOnSettled,
  });

  const generateProgramMutation = useMutation({
    mutationFn: async (newConfig: Record<string, number | string>) => {
      if (!definition) throw new Error('Unknown program definition');
      await createProgram(programId, definition.name, newConfig);
    },
    onSuccess: () => {
      trackEvent('program_start', { program: programId });
    },
    onError: () => {
      toast({ message: t('tracker.errors.program_create_failed') });
    },
    onSettled: () => {
      // exact: true busts the programs list only. No detail exists yet for a
      // freshly created program, so prefix-invalidating every cached detail
      // would only cause unnecessary refetches.
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all, exact: true });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: Record<string, number | string>) => {
      if (!activeInstanceId) throw new Error('No active program');
      await updateProgramConfig(activeInstanceId, newConfig);
    },
    onError: () => {
      toast({ message: t('tracker.errors.config_update_failed') });
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
      toast({ message: t('tracker.errors.program_finish_failed') });
    },
    onSettled: () => {
      // The finished detail is removed explicitly below; other details are
      // unaffected by finishing one program, so keep the invalidation exact.
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all, exact: true });
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
      toast({ message: t('tracker.errors.program_reset_failed') });
    },
    onSettled: () => {
      const deletedId = activeInstanceId;
      void queryClient.invalidateQueries({ queryKey: queryKeys.programs.all, exact: true });
      // The deleted program's detail is the only one affected; remove it
      // rather than invalidating every cached detail by prefix.
      if (deletedId) {
        queryClient.removeQueries({ queryKey: queryKeys.programs.detail(deletedId) });
      }
    },
  });

  return {
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
  };
}
