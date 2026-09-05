import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth-provider';
import { getActiveLocalDataOwner } from '../lib/db/client';
import { readSyncStatus, type SyncStatus } from '../lib/sync/sync-status-repository';
import { queueChanges, subscribeSyncAttempts, syncRequests } from '../lib/sync/sync-events';

export interface SyncStatusValue {
  readonly status: SyncStatus | null;
  readonly offline: boolean;
  readonly readError: boolean;
  readonly visible: boolean;
  readonly retry: () => void;
}

const SyncStatusContext = createContext<SyncStatusValue | null>(null);

/** One subscription per authenticated owner; screens only render its current state. */
export function SyncStatusProvider({ children }: PropsWithChildren) {
  const { user, isOffline } = useAuth();
  const ownerId = user?.id;
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [readError, setReadError] = useState(false);
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    let generation = 0;
    const refresh = (): void => {
      const request = ++generation;
      void readSyncStatus(ownerId)
        .then((next) => {
          if (!active || request !== generation || getActiveLocalDataOwner() !== ownerId) return;
          setStatus(next);
          setReadError(false);
        })
        .catch(() => {
          if (!active || request !== generation || getActiveLocalDataOwner() !== ownerId) return;
          setReadError(true);
        });
    };
    const changed = queueChanges.subscribe((owner) => {
      if (owner === ownerId) refresh();
    });
    const attempted = subscribeSyncAttempts((attempt) => {
      if (attempt.ownerId === ownerId) refresh();
    });
    const requested = syncRequests.subscribe((owner) => {
      if (owner === ownerId) refresh();
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    refresh();
    return () => {
      active = false;
      changed();
      attempted();
      requested();
      appState.remove();
    };
  }, [ownerId]);
  const retry = (): void => {
    if (ownerId && getActiveLocalDataOwner() === ownerId) syncRequests.publish(ownerId);
  };
  return (
    <SyncStatusContext.Provider
      value={{
        status,
        offline: isOffline,
        readError,
        visible: isOffline || readError || (status?.total ?? 0) > 0,
        retry,
      }}
    >
      {children}
    </SyncStatusContext.Provider>
  );
}

/** Absent on signed-out screens and isolated UI renders. */
export function useSyncStatus(): SyncStatusValue | null {
  return useContext(SyncStatusContext);
}
