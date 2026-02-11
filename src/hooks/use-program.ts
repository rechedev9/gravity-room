'use client';

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { StartWeights, Results, UndoHistory, Tier, ResultValue } from '@/types';
import { loadData, saveData, clearData, parseImportData, createExportData } from '@/lib/storage';

const emptySubscribe = (): (() => void) => () => {};
const returnTrue = (): boolean => true;
const returnFalse = (): boolean => false;

interface UseProgramReturn {
  startWeights: StartWeights | null;
  results: Results;
  undoHistory: UndoHistory;
  generateProgram: (weights: StartWeights) => void;
  updateWeights: (weights: StartWeights) => void;
  markResult: (index: number, tier: Tier, value: ResultValue) => void;
  setAmrapReps: (index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => void;
  undoSpecific: (index: number, tier: Tier) => void;
  undoLast: () => void;
  resetAll: () => void;
  exportData: () => void;
  importData: (json: string) => boolean;
}

export function useProgram(): UseProgramReturn {
  // useSyncExternalStore returns false on server, true on client — no hydration mismatch
  const isClient = useSyncExternalStore(emptySubscribe, returnTrue, returnFalse);

  const [startWeights, setStartWeights] = useState<StartWeights | null>(() =>
    isClient ? (loadData()?.startWeights ?? null) : null
  );
  const [results, setResults] = useState<Results>(() =>
    isClient ? (loadData()?.results ?? {}) : {}
  );
  const [undoHistory, setUndoHistory] = useState<UndoHistory>(() =>
    isClient ? (loadData()?.undoHistory ?? []) : []
  );
  const isInitialMount = useRef(true);

  // Save to localStorage on changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!startWeights) return;
    saveData({ results, startWeights, undoHistory });
  }, [results, startWeights, undoHistory]);

  const generateProgram = useCallback((weights: StartWeights) => {
    setStartWeights(weights);
    setResults({});
    setUndoHistory([]);
  }, []);

  const updateWeights = useCallback((weights: StartWeights) => {
    setStartWeights(weights);
  }, []);

  const markResult = useCallback(
    (index: number, tier: Tier, value: ResultValue) => {
      setUndoHistory((prev) => [...prev, { i: index, tier, prev: results[index]?.[tier] }]);
      setResults((prev) => ({
        ...prev,
        [index]: { ...prev[index], [tier]: value },
      }));
    },
    [results]
  );

  const setAmrapReps = useCallback(
    (index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => {
      setResults((prev) => {
        const entry = { ...prev[index] };
        if (reps === undefined) {
          delete entry[field];
        } else {
          entry[field] = reps;
        }
        return { ...prev, [index]: entry };
      });
    },
    []
  );

  const undoSpecific = useCallback(
    (index: number, tier: Tier) => {
      const currentValue = results[index]?.[tier];
      if (!currentValue) return;

      setUndoHistory((prev) => [...prev, { i: index, tier, prev: currentValue }]);
      setResults((prev) => {
        const updated = { ...prev };
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
      });
    },
    [results]
  );

  const undoLast = useCallback(() => {
    if (undoHistory.length === 0) return;

    const lastEntry = undoHistory[undoHistory.length - 1];
    setUndoHistory((prev) => prev.slice(0, -1));

    setResults((prev) => {
      const updated = { ...prev };
      if (lastEntry.prev === undefined) {
        // Remove the result
        if (updated[lastEntry.i]) {
          const entry = { ...updated[lastEntry.i] };
          const tier: Tier = lastEntry.tier;
          delete entry[tier];
          if (Object.keys(entry).length === 0) {
            delete updated[lastEntry.i];
          } else {
            updated[lastEntry.i] = entry;
          }
        }
      } else {
        // Restore the previous value
        updated[lastEntry.i] = {
          ...updated[lastEntry.i],
          [lastEntry.tier]: lastEntry.prev,
        };
      }
      return updated;
    });
  }, [undoHistory]);

  const resetAll = useCallback(() => {
    setStartWeights(null);
    setResults({});
    setUndoHistory([]);
    clearData();
  }, []);

  const exportDataFn = useCallback(() => {
    if (!startWeights) return;
    const data = createExportData({ results, startWeights, undoHistory });
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
  }, [results, startWeights, undoHistory]);

  const importDataFn = useCallback((json: string): boolean => {
    const data = parseImportData(json);
    if (!data) return false;
    setStartWeights(data.startWeights);
    setResults(data.results);
    setUndoHistory(data.undoHistory);
    return true;
  }, []);

  return {
    startWeights,
    results,
    undoHistory,
    generateProgram,
    updateWeights,
    markResult,
    setAmrapReps,
    undoSpecific,
    undoLast,
    resetAll,
    exportData: exportDataFn,
    importData: importDataFn,
  };
}
