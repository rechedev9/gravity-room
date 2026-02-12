import type { StoredData } from '@/lib/storage';

const STORAGE_KEY = 'gzclp-v3';
const V2_STORAGE_KEY = 'wt-programs-v1';
const SYNC_META_KEY = 'gzclp-sync-meta';

/** Seed localStorage with StoredData at the legacy key. */
export function seedLocalStorage(data: StoredData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Read and parse raw StoredData from the legacy key. */
export function readLocalStorage(): unknown {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

/** Read and parse raw data from the v2 key. */
export function readV2Storage(): unknown {
  const raw = localStorage.getItem(V2_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

/** Read and parse raw sync metadata. */
export function readSyncMeta(): unknown {
  const raw = localStorage.getItem(SYNC_META_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

/** Clear all app-related localStorage keys. */
export function clearAllStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(V2_STORAGE_KEY);
  localStorage.removeItem(SYNC_META_KEY);
}
