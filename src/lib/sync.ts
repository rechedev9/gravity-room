import type { SupabaseClient } from '@supabase/supabase-js';
import { type StoredData, validateStoredData } from './storage';
import { isRecord } from './type-guards';

const SYNC_META_KEY = 'gzclp-sync-meta';
const DATA_VERSION = 1;

export interface SyncMeta {
  readonly lastSyncedAt: string | null;
  readonly localUpdatedAt: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export type ConflictChoice = 'local' | 'cloud';

export interface CloudRow {
  readonly id: string;
  readonly user_id: string;
  readonly data: unknown;
  readonly updated_at: string;
  readonly created_at: string;
}

export function loadSyncMeta(): SyncMeta | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SYNC_META_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.localUpdatedAt !== 'string') return null;
    return {
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
      localUpdatedAt: parsed.localUpdatedAt,
    };
  } catch {
    return null;
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // QuotaExceededError — sync metadata is non-critical, cloud sync still functions
  }
}

export function clearSyncMeta(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SYNC_META_KEY);
}

export function markLocalUpdated(): void {
  const existing = loadSyncMeta();
  saveSyncMeta({
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    localUpdatedAt: new Date().toISOString(),
  });
}

export function markSynced(serverTimestamp?: string): void {
  const ts = serverTimestamp ?? new Date().toISOString();
  saveSyncMeta({
    lastSyncedAt: ts,
    localUpdatedAt: loadSyncMeta()?.localUpdatedAt ?? ts,
  });
}

export async function fetchCloudData(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: StoredData; updatedAt: string } | null> {
  const { data, error } = await supabase
    .from('user_programs')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  if (!isRecord(data) || typeof data.updated_at !== 'string') return null;

  const validated = validateStoredData(data.data);
  if (!validated) return null;

  return { data: validated, updatedAt: data.updated_at };
}

export interface PushResult {
  readonly success: boolean;
  readonly retryable: boolean;
}

export async function pushToCloud(
  supabase: SupabaseClient,
  userId: string,
  storedData: StoredData
): Promise<PushResult> {
  const { data, error } = await supabase
    .from('user_programs')
    .upsert(
      { user_id: userId, data: storedData, data_version: DATA_VERSION },
      { onConflict: 'user_id' }
    )
    .select('updated_at')
    .single();

  if (error) {
    const isRateLimit = error.message?.includes('Rate limit');
    return { success: false, retryable: isRateLimit };
  }

  const serverTimestamp =
    isRecord(data) && typeof data.updated_at === 'string' ? data.updated_at : undefined;
  markSynced(serverTimestamp);
  return { success: true, retryable: false };
}

export async function deleteCloudData(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { error } = await supabase.from('user_programs').delete().eq('user_id', userId);
  return !error;
}

export type InitialSyncResult =
  | { action: 'push' }
  | { action: 'pull'; data: StoredData }
  | { action: 'conflict'; cloudData: StoredData; cloudUpdatedAt: string }
  | { action: 'none' };

export function determineInitialSync(
  localData: StoredData | null,
  cloudResult: { data: StoredData; updatedAt: string } | null,
  syncMeta: SyncMeta | null
): InitialSyncResult {
  const hasLocal = localData !== null && localData.startWeights !== null;
  const hasCloud = cloudResult !== null;

  if (hasLocal && !hasCloud) {
    return { action: 'push' };
  }

  if (!hasLocal && hasCloud) {
    return { action: 'pull', data: cloudResult.data };
  }

  if (hasLocal && hasCloud) {
    if (!syncMeta?.lastSyncedAt) {
      return {
        action: 'conflict',
        cloudData: cloudResult.data,
        cloudUpdatedAt: cloudResult.updatedAt,
      };
    }

    const lastSync = new Date(syncMeta.lastSyncedAt).getTime();
    const localChanged = new Date(syncMeta.localUpdatedAt).getTime() > lastSync;
    const cloudChanged = new Date(cloudResult.updatedAt).getTime() > lastSync;

    if (localChanged && cloudChanged) {
      return {
        action: 'conflict',
        cloudData: cloudResult.data,
        cloudUpdatedAt: cloudResult.updatedAt,
      };
    }

    if (cloudChanged) {
      return { action: 'pull', data: cloudResult.data };
    }

    if (localChanged) {
      return { action: 'push' };
    }
  }

  return { action: 'none' };
}
