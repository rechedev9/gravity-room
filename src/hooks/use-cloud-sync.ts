'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import type { StoredData } from '@/lib/storage';
import {
  type SyncStatus,
  type InitialSyncResult,
  fetchCloudData,
  pushToCloud,
  deleteCloudData,
  determineInitialSync,
  loadSyncMeta,
  markLocalUpdated,
  markSynced,
  clearSyncMeta,
} from '@/lib/sync';

const DEBOUNCE_MS = 2000;

interface UseCloudSyncOptions {
  readonly user: User | null;
  readonly startWeights: StoredData['startWeights'] | null;
  readonly results: StoredData['results'];
  readonly undoHistory: StoredData['undoHistory'];
  readonly onCloudDataReceived: (data: StoredData) => void;
}

interface UseCloudSyncReturn {
  readonly syncStatus: SyncStatus;
  readonly conflict: ConflictState | null;
  readonly resolveConflict: (choice: 'local' | 'cloud') => void;
  readonly clearCloudData: () => Promise<void>;
}

interface ConflictState {
  readonly cloudData: StoredData;
  readonly cloudUpdatedAt: string;
}

export function useCloudSync({
  user,
  startWeights,
  results,
  undoHistory,
  onCloudDataReceived,
}: UseCloudSyncOptions): UseCloudSyncReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSyncDone = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  // Track online/offline
  useEffect(() => {
    const goOnline = (): void => setIsOnline(true);
    const goOffline = (): void => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return (): void => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Initial sync on login
  useEffect(() => {
    if (!user) {
      initialSyncDone.current = false;
      prevUserIdRef.current = null;
      return;
    }

    if (prevUserIdRef.current === user.id && initialSyncDone.current) return;
    prevUserIdRef.current = user.id;

    const supabase = getSupabaseClient();
    if (!supabase || !isOnline) return;

    const runInitialSync = async (): Promise<void> => {
      setSyncStatus('syncing');

      const cloudResult = await fetchCloudData(supabase, user.id);
      const localData: StoredData | null =
        startWeights !== null ? { startWeights, results, undoHistory } : null;
      const syncMeta = loadSyncMeta();

      const decision: InitialSyncResult = determineInitialSync(localData, cloudResult, syncMeta);

      switch (decision.action) {
        case 'push':
          if (localData) {
            await pushToCloud(supabase, user.id, localData);
          }
          setSyncStatus('synced');
          break;

        case 'pull':
          onCloudDataReceived(decision.data);
          markSynced();
          setSyncStatus('synced');
          break;

        case 'conflict':
          setConflict({
            cloudData: decision.cloudData,
            cloudUpdatedAt: decision.cloudUpdatedAt,
          });
          setSyncStatus('idle');
          break;

        case 'none':
          setSyncStatus('synced');
          break;
      }

      initialSyncDone.current = true;
    };

    void runInitialSync();
  }, [user, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced push on data change
  useEffect(() => {
    if (!user || !startWeights || !initialSyncDone.current || !isOnline) return;

    markLocalUpdated();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      setSyncStatus('syncing');
      void pushToCloud(supabase, user.id, { startWeights, results, undoHistory }).then(
        (success) => {
          setSyncStatus(success ? 'synced' : 'error');
        }
      );
    }, DEBOUNCE_MS);

    return (): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [user, startWeights, results, undoHistory, isOnline]);

  // Re-sync when coming back online
  useEffect(() => {
    if (!isOnline || !user || !startWeights || !initialSyncDone.current) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const syncOnReconnect = async (): Promise<void> => {
      setSyncStatus('syncing');
      const success = await pushToCloud(supabase, user.id, {
        startWeights,
        results,
        undoHistory,
      });
      setSyncStatus(success ? 'synced' : 'error');
    };

    void syncOnReconnect();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveConflict = useCallback(
    (choice: 'local' | 'cloud') => {
      if (!conflict || !user) return;

      const supabase = getSupabaseClient();
      if (!supabase) return;

      if (choice === 'cloud') {
        onCloudDataReceived(conflict.cloudData);
        markSynced();
        setSyncStatus('synced');
      } else {
        if (startWeights) {
          setSyncStatus('syncing');
          void pushToCloud(supabase, user.id, { startWeights, results, undoHistory }).then(
            (success) => {
              setSyncStatus(success ? 'synced' : 'error');
            }
          );
        }
      }

      setConflict(null);
    },
    [conflict, user, startWeights, results, undoHistory, onCloudDataReceived]
  );

  const clearCloudData = useCallback(async (): Promise<void> => {
    if (!user) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await deleteCloudData(supabase, user.id);
    clearSyncMeta();
  }, [user]);

  const effectiveStatus: SyncStatus = !user ? 'idle' : !isOnline ? 'offline' : syncStatus;

  return { syncStatus: effectiveStatus, conflict, resolveConflict, clearCloudData };
}
