import { useMemo, useState } from 'react';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUEST_INSTANCE_ID = 'guest';

// ---------------------------------------------------------------------------
// Helpers (mirrors use-program.ts helpers for in-memory mutations)
// ---------------------------------------------------------------------------

function setSlotResult(
  prev: GenericResults,
  workoutIndex: number,
  slotId: string,
  result: ResultValue,
  setLogs?: readonly SetLogEntry[]
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
        ...(setLogs !== undefined ? { setLogs: [...setLogs] } : {}),
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

function patchSlotField(
  prev: GenericResults,
  workoutIndex: number,
  slotId: string,
  field: 'amrapReps' | 'rpe',
  value: number | undefined
): GenericResults {
  const key = String(workoutIndex);
  const updatedResults = { ...prev };
  const workoutEntry = { ...updatedResults[key] };
  const slotEntry = { ...workoutEntry[slotId] };
  if (value === undefined) {
    delete slotEntry[field];
  } else {
    slotEntry[field] = value;
  }
  workoutEntry[slotId] = slotEntry;
  updatedResults[key] = workoutEntry;
  return updatedResults;
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

  // -- In-memory state --
  const [config, setConfig] = useState<Record<string, number | string> | null>(null);
  const [results, setResults] = useState<GenericResults>({});
  const [undoHistory, setUndoHistory] = useState<GenericUndoHistory>([]);
  const [resultTimestamps, setResultTimestamps] = useState<Readonly<Record<string, string>>>({});
  const [completedDates, setCompletedDates] = useState<Readonly<Record<string, string>>>({});
  const [metadata, setMetadata] = useState<unknown>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
    setIsGenerating(false);
  };

  const markResult = (
    index: number,
    slotId: string,
    value: ResultValue,
    setLogs?: readonly SetLogEntry[]
  ): void => {
    setResults((prev) => setSlotResult(prev, index, slotId, value, setLogs));
    setUndoHistory((prev) => [...prev, { i: index, slotId }]);
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
        setResults((prevResults) => removeSlotResult(prevResults, last.i, last.slotId));
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
  };

  const resetAll = (onSuccess?: () => void): void => {
    setConfig(null);
    setResults({});
    setUndoHistory([]);
    setResultTimestamps({});
    setCompletedDates({});
    setMetadata(null);
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
