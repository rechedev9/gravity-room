/** Synchronization state displayed in the app header and avatar dropdown. */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export const SYNC_COLORS: Readonly<Record<SyncStatus, string>> = {
  idle: '',
  syncing: 'text-btn-text',
  synced: 'text-ok',
  offline: 'text-muted',
  error: 'text-error',
} as const;
