/** Synchronization state displayed in the app header and avatar dropdown. */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export const SYNC_LABELS: Readonly<Record<SyncStatus, string>> = {
  idle: '',
  syncing: 'Sincronizando...',
  synced: 'Sincronizado',
  offline: 'Sin conexión',
  error: 'Error de sincronización',
} as const;

export const SYNC_COLORS: Readonly<Record<SyncStatus, string>> = {
  idle: '',
  syncing: 'text-btn-text',
  synced: 'text-ok',
  offline: 'text-muted',
  error: 'text-error',
} as const;
