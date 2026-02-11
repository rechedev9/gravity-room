'use client';

import { useState, useCallback, useEffect } from 'react';
import type { StartWeights, Results, UndoHistory, Tier, ResultValue } from '@/types';
import { loadData, saveData, parseImportData, createExportData } from '@/lib/storage';

interface UseProgramReturn {
  startWeights: StartWeights | null;
  results: Results;
  undoHistory: UndoHistory;
  generateProgram: (weights: StartWeights) => void;
  markResult: (index: number, tier: Tier, value: ResultValue) => void;
  undoSpecific: (index: number, tier: Tier) => void;
  undoLast: () => void;
  resetAll: () => void;
  exportData: () => void;
  importData: (json: string) => boolean;
}

export function useProgram(): UseProgramReturn {
  const [startWeights, setStartWeights] = useState<StartWeights | null>(null);
  const [results, setResults] = useState<Results>({});
  const [undoHistory, setUndoHistory] = useState<UndoHistory>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const data = loadData();
    if (data) {
      setStartWeights(data.startWeights);
      setResults(data.results);
      setUndoHistory(data.undoHistory);
    }
    setLoaded(true);
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    if (!loaded || !startWeights) return;
    saveData({ results, startWeights, undoHistory });
  }, [results, startWeights, undoHistory, loaded]);

  const generateProgram = useCallback((weights: StartWeights) => {
    setStartWeights(weights);
    setResults({});
    setUndoHistory([]);
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
    setResults({});
    setUndoHistory([]);
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
    markResult,
    undoSpecific,
    undoLast,
    resetAll,
    exportData: exportDataFn,
    importData: importDataFn,
  };
}
