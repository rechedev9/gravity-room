import { describe, it, expect } from 'bun:test';
import {
  loadData,
  saveData,
  clearData,
  createExportData,
  parseImportData,
  validateStoredData,
} from './storage';
import type { StoredData } from './storage';
import { DEFAULT_WEIGHTS, buildStoredData, buildResults } from '../../test/helpers/fixtures';

// ---------------------------------------------------------------------------
// Round-trip: saveData → loadData
// ---------------------------------------------------------------------------
describe('storage round-trip', () => {
  it('should round-trip empty program data', () => {
    const data = buildStoredData();
    saveData(data);
    const loaded = loadData();

    expect(loaded).toEqual(data);
  });

  it('should round-trip program data with results and undo history', () => {
    const data: StoredData = {
      startWeights: DEFAULT_WEIGHTS,
      results: buildResults([
        [0, { t1: 'success', t2: 'fail', t3: 'success', t1Reps: 5 }],
        [1, { t1: 'fail' }],
        [4, { t1: 'success', t3: 'success', t3Reps: 30 }],
      ]),
      undoHistory: [
        { i: 4, tier: 't1', prev: undefined },
        { i: 0, tier: 't3', prev: 'fail' },
      ],
    };
    saveData(data);
    const loaded = loadData();

    expect(loaded).toEqual(data);
  });

  it('should overwrite previous data on save', () => {
    const first = buildStoredData({ startWeights: { squat: 100 } });
    const second = buildStoredData({ startWeights: { squat: 200 } });

    saveData(first);
    saveData(second);
    const loaded = loadData();

    expect(loaded?.startWeights.squat).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// loadData: corrupted/invalid data
// ---------------------------------------------------------------------------
describe('loadData with invalid data', () => {
  it('should return null when localStorage is empty', () => {
    expect(loadData()).toBeNull();
  });

  it('should return null for corrupted JSON', () => {
    localStorage.setItem('gzclp-v3', '{not valid json');
    expect(loadData()).toBeNull();
  });

  it('should return null for non-object data', () => {
    localStorage.setItem('gzclp-v3', '"just a string"');
    expect(loadData()).toBeNull();
  });

  it('should return null for array data', () => {
    localStorage.setItem('gzclp-v3', '[1, 2, 3]');
    expect(loadData()).toBeNull();
  });

  it('should return null for invalid startWeights (missing fields)', () => {
    const bad = { startWeights: { squat: 60 }, results: {}, undoHistory: [] };
    localStorage.setItem('gzclp-v3', JSON.stringify(bad));
    expect(loadData()).toBeNull();
  });

  it('should return null for startWeights below minimum', () => {
    const bad = {
      startWeights: { squat: 0, bench: 0, deadlift: 0, ohp: 0, latpulldown: 0, dbrow: 0 },
      results: {},
      undoHistory: [],
    };
    localStorage.setItem('gzclp-v3', JSON.stringify(bad));
    expect(loadData()).toBeNull();
  });

  it('should return null for invalid result values', () => {
    const bad = {
      startWeights: DEFAULT_WEIGHTS,
      results: { 0: { t1: 'maybe' } }, // invalid result value
      undoHistory: [],
    };
    localStorage.setItem('gzclp-v3', JSON.stringify(bad));
    expect(loadData()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearData
// ---------------------------------------------------------------------------
describe('clearData', () => {
  it('should remove data from localStorage', () => {
    saveData(buildStoredData());
    expect(loadData()).not.toBeNull();

    clearData();
    expect(loadData()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Export/Import round-trip
// ---------------------------------------------------------------------------
describe('export/import round-trip', () => {
  it('should round-trip data through export → JSON → import', () => {
    const original = buildStoredData({
      results: buildResults([
        [0, { t1: 'success', t2: 'success', t3: 'success' }],
        [5, { t1: 'fail' }],
      ]),
    });

    const exported = createExportData(original);
    const json = JSON.stringify(exported);
    const imported = parseImportData(json);

    expect(imported).toEqual(original);
  });

  it('should include version and exportDate in export', () => {
    const exported = createExportData(buildStoredData());

    expect(exported.version).toBe(3);
    expect(exported.exportDate).toBeTruthy();
    // exportDate should be a valid ISO string
    expect(new Date(exported.exportDate).toISOString()).toBe(exported.exportDate);
  });

  it('should reject import of invalid JSON', () => {
    expect(parseImportData('not json')).toBeNull();
  });

  it('should reject import missing required fields', () => {
    const partial = JSON.stringify({ version: 3 });
    expect(parseImportData(partial)).toBeNull();
  });

  it('should reject import with wrong version type', () => {
    const bad = JSON.stringify({
      version: 'three',
      exportDate: new Date().toISOString(),
      results: {},
      startWeights: DEFAULT_WEIGHTS,
      undoHistory: [],
    });
    expect(parseImportData(bad)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateStoredData
// ---------------------------------------------------------------------------
describe('validateStoredData', () => {
  it('should validate correct data', () => {
    const data = buildStoredData();
    expect(validateStoredData(data)).toEqual(data);
  });

  it('should return null for null input', () => {
    expect(validateStoredData(null)).toBeNull();
  });

  it('should return null for non-object input', () => {
    expect(validateStoredData('string')).toBeNull();
    expect(validateStoredData(42)).toBeNull();
    expect(validateStoredData([])).toBeNull();
  });

  it('should default missing results and undoHistory', () => {
    const result = validateStoredData({ startWeights: DEFAULT_WEIGHTS });
    expect(result).toEqual({
      startWeights: DEFAULT_WEIGHTS,
      results: {},
      undoHistory: [],
    });
  });
});
