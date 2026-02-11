import { StartWeightsSchema, ResultsSchema, UndoHistorySchema, ExportDataSchema } from './schemas';
import type { StartWeights, Results, UndoHistory, ExportData } from '@/types';

const STORAGE_KEY = 'gzclp-v3';

interface StoredData {
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
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const obj = Object.fromEntries(Object.entries(parsed));
    const results = ResultsSchema.safeParse(obj.results ?? {});
    const startWeights = StartWeightsSchema.safeParse(obj.startWeights ?? {});
    const undoHistory = UndoHistorySchema.safeParse(obj.undoHistory ?? []);

    if (!startWeights.success) return null;

    return {
      results: results.success ? results.data : {},
      startWeights: startWeights.data,
      undoHistory: undoHistory.success ? undoHistory.data : [],
    };
  } catch {
    return null;
  }
}

export function saveData(data: StoredData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
