import { describe, it, expect } from 'bun:test';
import {
  loadInstanceMap,
  saveInstanceMap,
  clearInstanceMap,
  getActiveInstance,
  updateInstance,
  loadDataCompat,
  saveDataCompat,
  clearDataCompat,
} from './storage-v2';
import { GZCLP_MIGRATED_ID } from './migrations/v3-to-v1';
import { loadData as legacyLoadData, saveData as legacySaveData } from './storage';
import type { StoredData } from './storage';
import type { ProgramInstanceMap } from '@/types/program';
import { DEFAULT_WEIGHTS, buildStoredData, buildResults } from '../../test/helpers/fixtures';
import { readV2Storage } from '../../test/helpers/storage-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildInstanceMap(overrides?: Partial<ProgramInstanceMap>): ProgramInstanceMap {
  const now = new Date().toISOString();
  return {
    version: 1,
    activeProgramId: GZCLP_MIGRATED_ID,
    instances: {
      [GZCLP_MIGRATED_ID]: {
        id: GZCLP_MIGRATED_ID,
        programId: 'gzclp',
        name: 'GZCLP',
        config: { ...DEFAULT_WEIGHTS },
        results: {},
        undoHistory: [],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Instance map CRUD round-trip
// ---------------------------------------------------------------------------
describe('instance map CRUD', () => {
  it('should round-trip instance map through save/load', () => {
    const map = buildInstanceMap();
    saveInstanceMap(map);
    const loaded = loadInstanceMap();

    expect(loaded).toEqual(map);
  });

  it('should return null when no instance map exists', () => {
    expect(loadInstanceMap()).toBeNull();
  });

  it('should return null for corrupted instance map', () => {
    localStorage.setItem('wt-programs-v1', 'broken json{{{');
    expect(loadInstanceMap()).toBeNull();
  });

  it('should clear instance map', () => {
    saveInstanceMap(buildInstanceMap());
    clearInstanceMap();
    expect(loadInstanceMap()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getActiveInstance
// ---------------------------------------------------------------------------
describe('getActiveInstance', () => {
  it('should return the active instance', () => {
    const map = buildInstanceMap();
    const active = getActiveInstance(map);

    expect(active).not.toBeNull();
    expect(active?.programId).toBe('gzclp');
  });

  it('should return null when activeProgramId is null', () => {
    const map = buildInstanceMap({ activeProgramId: null });
    expect(getActiveInstance(map)).toBeNull();
  });

  it('should return null when activeProgramId references missing instance', () => {
    const map = buildInstanceMap({ activeProgramId: 'nonexistent' });
    expect(getActiveInstance(map)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateInstance
// ---------------------------------------------------------------------------
describe('updateInstance', () => {
  it('should apply updates and set a valid updatedAt', () => {
    const map = buildInstanceMap();
    const updated = updateInstance(map, GZCLP_MIGRATED_ID, { name: 'My GZCLP' });

    expect(updated.instances[GZCLP_MIGRATED_ID].name).toBe('My GZCLP');
    // updatedAt should be a valid ISO date string
    const ts = new Date(updated.instances[GZCLP_MIGRATED_ID].updatedAt);
    expect(ts.toISOString()).toBe(updated.instances[GZCLP_MIGRATED_ID].updatedAt);
  });

  it('should not mutate the original map', () => {
    const map = buildInstanceMap();
    const originalName = map.instances[GZCLP_MIGRATED_ID].name;

    updateInstance(map, GZCLP_MIGRATED_ID, { name: 'Changed' });

    expect(map.instances[GZCLP_MIGRATED_ID].name).toBe(originalName);
  });

  it('should return unchanged map for nonexistent instance ID', () => {
    const map = buildInstanceMap();
    const result = updateInstance(map, 'no-such-id', { name: 'x' });

    expect(result).toEqual(map);
  });
});

// ---------------------------------------------------------------------------
// Compat layer: legacy → new format migration
// ---------------------------------------------------------------------------
describe('loadDataCompat: legacy migration', () => {
  it('should migrate legacy data to new format on first load', () => {
    const legacy: StoredData = {
      startWeights: DEFAULT_WEIGHTS,
      results: buildResults([[0, { t1: 'success', t2: 'success', t3: 'success' }]]),
      undoHistory: [{ i: 0, tier: 't1', prev: undefined }],
    };
    legacySaveData(legacy);

    const loaded = loadDataCompat();

    // Should return the legacy data converted back
    expect(loaded).not.toBeNull();
    expect(loaded?.startWeights).toEqual(DEFAULT_WEIGHTS);
    expect(loaded?.results[0]?.t1).toBe('success');

    // New format should now exist in v2 storage
    expect(readV2Storage()).not.toBeNull();
  });

  it('should return null when no data exists anywhere', () => {
    expect(loadDataCompat()).toBeNull();
  });

  it('should prefer new format over legacy', () => {
    // Save to both formats with different data
    const newMap = buildInstanceMap();
    newMap.instances[GZCLP_MIGRATED_ID].config = {
      ...DEFAULT_WEIGHTS,
      squat: 999, // different from legacy
    };
    saveInstanceMap(newMap);

    legacySaveData(buildStoredData({ startWeights: { squat: 100 } }));

    const loaded = loadDataCompat();
    expect(loaded?.startWeights.squat).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// Compat layer: dual-write
// ---------------------------------------------------------------------------
describe('saveDataCompat: dual-write', () => {
  it('should write to both new and legacy formats', () => {
    const data = buildStoredData({
      results: buildResults([[0, { t1: 'success' }]]),
    });

    saveDataCompat(data);

    // Legacy format should exist
    const legacy = legacyLoadData();
    expect(legacy).not.toBeNull();
    expect(legacy?.results[0]?.t1).toBe('success');

    // New format should exist
    const map = loadInstanceMap();
    expect(map).not.toBeNull();
    expect(getActiveInstance(map!)).not.toBeNull();
  });

  it('should update existing instance on subsequent saves', () => {
    saveDataCompat(buildStoredData());
    saveDataCompat(buildStoredData({ startWeights: { squat: 200 } }));

    const loaded = loadDataCompat();
    expect(loaded?.startWeights.squat).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Compat layer: clearDataCompat
// ---------------------------------------------------------------------------
describe('clearDataCompat', () => {
  it('should clear both new and legacy formats', () => {
    saveDataCompat(buildStoredData());

    clearDataCompat();

    expect(legacyLoadData()).toBeNull();
    expect(loadInstanceMap()).toBeNull();
  });
});
