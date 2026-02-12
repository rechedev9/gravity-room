import { describe, it, expect } from 'bun:test';
import {
  loadSyncMeta,
  saveSyncMeta,
  clearSyncMeta,
  markLocalUpdated,
  markSynced,
  determineInitialSync,
} from './sync';
import type { SyncMeta } from './sync';
import { buildStoredData } from '../../test/helpers/fixtures';
import type { StoredData } from './storage';

// ---------------------------------------------------------------------------
// SyncMeta round-trip through real localStorage
// ---------------------------------------------------------------------------
describe('sync metadata round-trip', () => {
  it('should round-trip sync metadata through save/load', () => {
    const meta: SyncMeta = {
      lastSyncedAt: '2025-01-15T10:00:00.000Z',
      localUpdatedAt: '2025-01-15T10:30:00.000Z',
    };
    saveSyncMeta(meta);
    const loaded = loadSyncMeta();

    expect(loaded).toEqual(meta);
  });

  it('should return null when no sync meta exists', () => {
    expect(loadSyncMeta()).toBeNull();
  });

  it('should return null for corrupted sync meta', () => {
    localStorage.setItem('gzclp-sync-meta', 'not json');
    expect(loadSyncMeta()).toBeNull();
  });

  it('should return null when localUpdatedAt is missing', () => {
    localStorage.setItem('gzclp-sync-meta', JSON.stringify({ lastSyncedAt: 'x' }));
    expect(loadSyncMeta()).toBeNull();
  });

  it('should clear sync metadata', () => {
    saveSyncMeta({ lastSyncedAt: null, localUpdatedAt: new Date().toISOString() });
    clearSyncMeta();
    expect(loadSyncMeta()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// markLocalUpdated / markSynced
// ---------------------------------------------------------------------------
describe('markLocalUpdated', () => {
  it('should set localUpdatedAt while preserving lastSyncedAt', () => {
    saveSyncMeta({
      lastSyncedAt: '2025-01-01T00:00:00.000Z',
      localUpdatedAt: '2025-01-01T00:00:00.000Z',
    });

    markLocalUpdated();

    const meta = loadSyncMeta();
    expect(meta?.lastSyncedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(meta).not.toBeNull();
    expect(meta!.localUpdatedAt).not.toBe('2025-01-01T00:00:00.000Z');
  });

  it('should work when no existing meta exists', () => {
    markLocalUpdated();
    const meta = loadSyncMeta();
    expect(meta?.lastSyncedAt).toBeNull();
    expect(meta?.localUpdatedAt).toBeTruthy();
  });
});

describe('markSynced', () => {
  it('should set lastSyncedAt from server timestamp', () => {
    markLocalUpdated(); // ensure meta exists
    markSynced('2025-06-01T12:00:00.000Z');

    const meta = loadSyncMeta();
    expect(meta?.lastSyncedAt).toBe('2025-06-01T12:00:00.000Z');
  });

  it('should use current time when no server timestamp provided', () => {
    markSynced();
    const meta = loadSyncMeta();
    expect(meta).not.toBeNull();
    const lastSynced = meta!.lastSyncedAt;
    if (lastSynced === null) throw new Error('expected lastSyncedAt to be set');
    // Should be a valid ISO string
    expect(new Date(lastSynced).toISOString()).toBe(lastSynced);
  });
});

// ---------------------------------------------------------------------------
// determineInitialSync — all 4 decision branches
// ---------------------------------------------------------------------------
describe('determineInitialSync', () => {
  const localData: StoredData = buildStoredData();
  const cloudData: StoredData = buildStoredData({ startWeights: { squat: 100 } });
  const cloudResult = { data: cloudData, updatedAt: '2025-01-15T12:00:00.000Z' };

  it('should return "push" when only local data exists', () => {
    const result = determineInitialSync(localData, null, null);
    expect(result).toEqual({ action: 'push' });
  });

  it('should return "pull" when only cloud data exists', () => {
    const result = determineInitialSync(null, cloudResult, null);
    expect(result.action).toBe('pull');
    if (result.action === 'pull') {
      expect(result.data).toEqual(cloudData);
    }
  });

  it('should return "none" when neither local nor cloud data exists', () => {
    const result = determineInitialSync(null, null, null);
    expect(result).toEqual({ action: 'none' });
  });

  it('should return "conflict" when both exist but no sync history', () => {
    const result = determineInitialSync(localData, cloudResult, null);
    expect(result.action).toBe('conflict');
  });

  it('should return "conflict" when both local and cloud changed since last sync', () => {
    const syncMeta: SyncMeta = {
      lastSyncedAt: '2025-01-10T00:00:00.000Z',
      localUpdatedAt: '2025-01-15T00:00:00.000Z', // after lastSyncedAt
    };
    const cloudAfterSync = { data: cloudData, updatedAt: '2025-01-15T06:00:00.000Z' };

    const result = determineInitialSync(localData, cloudAfterSync, syncMeta);
    expect(result.action).toBe('conflict');
  });

  it('should return "pull" when only cloud changed since last sync', () => {
    const syncMeta: SyncMeta = {
      lastSyncedAt: '2025-01-10T00:00:00.000Z',
      localUpdatedAt: '2025-01-09T00:00:00.000Z', // before lastSyncedAt
    };
    const cloudAfterSync = { data: cloudData, updatedAt: '2025-01-15T06:00:00.000Z' };

    const result = determineInitialSync(localData, cloudAfterSync, syncMeta);
    expect(result.action).toBe('pull');
  });

  it('should return "push" when only local changed since last sync', () => {
    const syncMeta: SyncMeta = {
      lastSyncedAt: '2025-01-15T00:00:00.000Z',
      localUpdatedAt: '2025-01-16T00:00:00.000Z', // after lastSyncedAt
    };
    const cloudBeforeSync = { data: cloudData, updatedAt: '2025-01-14T00:00:00.000Z' };

    const result = determineInitialSync(localData, cloudBeforeSync, syncMeta);
    expect(result.action).toBe('push');
  });

  it('should return "none" when neither changed since last sync', () => {
    const syncMeta: SyncMeta = {
      lastSyncedAt: '2025-01-15T00:00:00.000Z',
      localUpdatedAt: '2025-01-14T00:00:00.000Z', // before lastSyncedAt
    };
    const cloudBeforeSync = { data: cloudData, updatedAt: '2025-01-14T00:00:00.000Z' };

    const result = determineInitialSync(localData, cloudBeforeSync, syncMeta);
    expect(result).toEqual({ action: 'none' });
  });
});
