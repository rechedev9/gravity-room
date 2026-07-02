import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import { isRecord } from '@gzclp/domain/type-guards';
import type {
  ProgramDefinition,
  GenericResults,
  GenericUndoHistory,
} from '@gzclp/domain/types/program';
import type { GenericWorkoutRow, ResultValue, SetLogEntry } from '@gzclp/domain/types';
import { queryKeys } from '@/lib/query-keys';
import { fetchCatalogDetail } from '@/lib/api-functions';
import type { UseProgramReturn } from '@/hooks/use-program';
import {
  setSlotResult,
  removeSlotResult,
  patchSlotField,
  applyUndoEntry,
} from '@/lib/slot-result-helpers';
import { readGuestData, writeGuestData } from '@/lib/guest-storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUEST_INSTANCE_ID = 'guest';

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Reads the persisted guest instance, but only if it belongs to the program
 * currently being viewed — a guest can only have one active program at a
 * time (mirrors the single `GUEST_INSTANCE_ID` slot), so switching to a
 * different program's page should not resurrect a stale, unrelated instance.
 */
function readGuestInstance(programId: string): {
  readonly config: Record<string, number | string>;
  readonly results: GenericResults;
  readonly undoHistory: GenericUndoHistory;
  readonly createdAt: string;
} | null {
  const instance = readGuestData()?.instances[GUEST_INSTANCE_ID];
  if (!instance || instance.programId !== programId) return null;
  return {
    config: instance.config,
    results: instance.results,
    undoHistory: instance.undoHistory,
    createdAt: instance.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGuestProgram(programId: string): UseProgramReturn {
  // -- Catalog query (public, no auth required) --
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail(programId),
    queryFn: () => fetchCatalogDetail(programId),
    staleTime: 5 * 60 * 1000,
  });

  const definition: ProgramDefinition | undefined = catalogQuery.data;

  // -- State, hydrated once from localStorage so a reload doesn't wipe an
  // in-progress guest program (see guest-storage.ts). --
  const [config, setConfig] = useState<Record<string, number | string> | null>(
    () => readGuestInstance(programId)?.config ?? null
  );
  const [results, setResults] = useState<GenericResults>(
    () => readGuestInstance(programId)?.results ?? {}
  );
  const [undoHistory, setUndoHistory] = useState<GenericUndoHistory>(
    () => readGuestInstance(programId)?.undoHistory ?? []
  );
  const [createdAt, setCreatedAt] = useState<string | null>(
    () => readGuestInstance(programId)?.createdAt ?? null
  );
  // Not part of the persisted ProgramInstance shape (see packages/domain
  // schemas/instance.ts) — these remain ephemeral, same tradeoff as before
  // this change, just no longer masking the loss of the far more important
  // config/results/undoHistory.
  const [resultTimestamps, setResultTimestamps] = useState<Readonly<Record<string, string>>>({});
  const [completedDates, setCompletedDates] = useState<Readonly<Record<string, string>>>({});
  const [metadata, setMetadata] = useState<unknown>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // -- Persist config/results/undoHistory on every change (cheap at this
  // scale — a single guest program's worth of data). --
  useEffect(() => {
    if (config === null) {
      // No active guest program (finished/reset) — drop any persisted instance.
      const existing = readGuestData();
      if (existing && GUEST_INSTANCE_ID in existing.instances) {
        const rest = { ...existing.instances };
        delete rest[GUEST_INSTANCE_ID];
        writeGuestData({ ...existing, activeProgramId: null, instances: rest });
      }
      return;
    }
    if (!definition) return;
    const now = new Date().toISOString();
    writeGuestData({
      version: 1,
      activeProgramId: GUEST_INSTANCE_ID,
      instances: {
        [GUEST_INSTANCE_ID]: {
          id: GUEST_INSTANCE_ID,
          programId,
          name: definition.name,
          config,
          results,
          undoHistory,
          status: 'active',
          createdAt: createdAt ?? now,
          updatedAt: now,
        },
      },
    });
    // createdAt is intentionally excluded from deps — it changes as a result
    // of this effect writing state, and re-running on it would be circular.
  }, [config, results, undoHistory, definition, programId]);

  // -- Computed rows --
  const rows: readonly GenericWorkoutRow[] = useMemo(() => {
    if (!definition || !config) return [];
    return computeGenericProgram(definition, config, results);
  }, [definition, config, results]);

  // -- Derived state --
  const isLoading = catalogQuery.isLoading;
  const activeInstanceId: string | null = config !== null ? GUEST_INSTANCE_ID : null;

  // -- Actions --

  const generateProgram = async (newConfig: Record<string, number | string>): Promise<void> => {
    if (!definition) return;
    setIsGenerating(true);
    setConfig(newConfig);
    setResults({});
    setUndoHistory([]);
    setResultTimestamps({});
    setCompletedDates({});
    setMetadata(null);
    setCreatedAt(new Date().toISOString());
    setIsGenerating(false);
  };

  const markResult = (
    index: number,
    slotId: string,
    value: ResultValue,
    setLogs?: readonly SetLogEntry[]
  ): void => {
    // Capture the pre-overwrite snapshot so undoLast can restore it instead of
    // deleting it outright — mirrors the authenticated applyUndoLast semantics
    // (see use-program-mutations.ts) and GenericUndoHistorySchema.
    const existingSlot = results[String(index)]?.[slotId];
    setResults((prev) => setSlotResult(prev, index, slotId, value, undefined, setLogs));
    setUndoHistory((prev) => [
      ...prev,
      {
        i: index,
        slotId,
        ...(existingSlot?.result !== undefined ? { prev: existingSlot.result } : {}),
        ...(existingSlot?.rpe !== undefined ? { prevRpe: existingSlot.rpe } : {}),
        ...(existingSlot?.amrapReps !== undefined ? { prevAmrapReps: existingSlot.amrapReps } : {}),
        ...(existingSlot?.setLogs !== undefined ? { prevSetLogs: existingSlot.setLogs } : {}),
      },
    ]);
    setResultTimestamps((prev) => ({
      ...prev,
      [String(index)]: new Date().toISOString(),
    }));

    // Check if all slots in this workout are now completed to populate completedDates.
    // Read-only state updater: setResults is called with an updater that returns `current`
    // unchanged — its sole purpose is to read the latest results state synchronously
    // (after the previous setResults has been batched) to determine completion.
    if (definition && config) {
      setResults((current) => {
        const key = String(index);
        const workoutSlots = definition.days[index % definition.days.length]?.slots ?? [];
        const allCompleted = workoutSlots.every((slot) => current[key]?.[slot.id]?.result);
        if (allCompleted) {
          setCompletedDates((prevDates) => ({
            ...prevDates,
            [key]: new Date().toISOString(),
          }));
        }
        return current;
      });
    }
  };

  const setAmrapReps = (index: number, slotId: string, reps: number | undefined): void => {
    setResults((prev) => patchSlotField(prev, index, slotId, 'amrapReps', reps));
  };

  const setRpe = (index: number, slotId: string, rpe: number | undefined): void => {
    setResults((prev) => patchSlotField(prev, index, slotId, 'rpe', rpe));
  };

  const undoSpecific = (index: number, slotId: string): void => {
    setResults((prev) => removeSlotResult(prev, index, slotId));
  };

  const undoLast = (): void => {
    setUndoHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last) {
        setResults((prevResults) => applyUndoEntry(prevResults, last));
      }
      return prev.slice(0, -1);
    });
  };

  const updateConfig = (newConfig: Record<string, number | string>): void => {
    setConfig(newConfig);
  };

  const updateConfigAsync = async (newConfig: Record<string, number | string>): Promise<void> => {
    setConfig(newConfig);
  };

  const updateMetadata = (newMetadata: Record<string, unknown>): void => {
    setMetadata((prev: unknown) => ({
      ...(isRecord(prev) ? prev : {}),
      ...newMetadata,
    }));
  };

  const finishProgram = async (): Promise<void> => {
    setConfig(null);
    setResults({});
    setUndoHistory([]);
    setResultTimestamps({});
    setCompletedDates({});
    setMetadata(null);
    setCreatedAt(null);
  };

  const resetAll = (onSuccess?: () => void): void => {
    setConfig(null);
    setResults({});
    setUndoHistory([]);
    setResultTimestamps({});
    setCompletedDates({});
    setMetadata(null);
    setCreatedAt(null);
    onSuccess?.();
  };

  const exportData = (): void => {
    // No-op for guest mode — data is ephemeral
  };

  const importData = async (): Promise<boolean> => {
    // Blocked for guest mode
    return false;
  };

  return {
    definition,
    config,
    metadata,
    rows,
    undoHistory,
    resultTimestamps,
    completedDates,
    isLoading,
    isGenerating,
    activeInstanceId,
    generateProgram,
    updateConfig,
    updateMetadata,
    markResult,
    setAmrapReps,
    setRpe,
    undoSpecific,
    undoLast,
    finishProgram,
    isFinishing: false,
    resetAll,
    exportData,
    importData,
    updateConfigAsync,
  } satisfies UseProgramReturn;
}
