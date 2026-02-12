import { StartWeightsSchema, ResultsSchema, UndoHistorySchema, ExportDataSchema } from './schemas';
import type { StartWeights, Results, UndoHistory, ExportData } from '@/types';
import { isRecord } from './type-guards';

const STORAGE_KEY = 'gzclp-v3';

export interface StoredData {
  results: Results;
  startWeights: StartWeights;
  undoHistory: UndoHistory;
}

export function loadData(): StoredData | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const results = ResultsSchema.safeParse(parsed.results ?? {});
    const startWeights = StartWeightsSchema.safeParse(parsed.startWeights ?? {});
    const undoHistory = UndoHistorySchema.safeParse(parsed.undoHistory ?? []);

    if (!startWeights.success || !results.success || !undoHistory.success) return null;

    return {
      results: results.data,
      startWeights: startWeights.data,
      undoHistory: undoHistory.data,
    };
  } catch {
    return null;
  }
}

export function saveData(data: StoredData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // QuotaExceededError — data persists in React state, syncs to cloud on next opportunity
  }
}

export function clearData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function createExportData(data: StoredData): ExportData {
  return {
    version: 3,
    exportDate: new Date().toISOString(),
    results: data.results,
    startWeights: data.startWeights,
    undoHistory: data.undoHistory,
  };
}

export function validateStoredData(data: unknown): StoredData | null {
  try {
    if (!isRecord(data)) return null;
    const results = ResultsSchema.safeParse(data.results ?? {});
    const startWeights = StartWeightsSchema.safeParse(data.startWeights ?? {});
    const undoHistory = UndoHistorySchema.safeParse(data.undoHistory ?? []);

    if (!startWeights.success || !results.success || !undoHistory.success) return null;

    return {
      results: results.data,
      startWeights: startWeights.data,
      undoHistory: undoHistory.data,
    };
  } catch {
    return null;
  }
}

export function parseImportData(json: string): StoredData | null {
  try {
    const parsed: unknown = JSON.parse(json);
    const result = ExportDataSchema.safeParse(parsed);
    if (!result.success) return null;
    return {
      results: result.data.results,
      startWeights: result.data.startWeights,
      undoHistory: result.data.undoHistory,
    };
  } catch {
    return null;
  }
}
