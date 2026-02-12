import { describe, it, expect } from 'bun:test';
import {
  convertResultsToGeneric,
  convertResultsToLegacy,
  convertUndoToGeneric,
  convertUndoToLegacy,
  convertLegacyToInstanceMap,
  GZCLP_MIGRATED_ID,
} from './v3-to-v1';
import { DEFAULT_WEIGHTS, buildResults } from '../../../test/helpers/fixtures';
import type { Results, UndoHistory } from '@/types';

// ---------------------------------------------------------------------------
// Results conversion round-trip: legacy → generic → legacy
// ---------------------------------------------------------------------------
describe('results conversion round-trip', () => {
  it('should round-trip empty results', () => {
    const original: Results = {};
    const generic = convertResultsToGeneric(original);
    const backToLegacy = convertResultsToLegacy(generic);

    expect(backToLegacy).toEqual(original);
  });

  it('should round-trip results with all tiers', () => {
    const original = buildResults([
      [0, { t1: 'success', t2: 'fail', t3: 'success' }],
      [1, { t1: 'fail', t2: 'success', t3: 'fail' }],
      [4, { t1: 'success' }],
    ]);
    const generic = convertResultsToGeneric(original);
    const backToLegacy = convertResultsToLegacy(generic);

    expect(backToLegacy).toEqual(original);
  });

  it('should preserve AMRAP reps through round-trip', () => {
    const original = buildResults([
      [0, { t1: 'success', t1Reps: 8, t3: 'success', t3Reps: 30 }],
      [1, { t1: 'fail', t1Reps: 2 }],
    ]);
    const generic = convertResultsToGeneric(original);
    const backToLegacy = convertResultsToLegacy(generic);

    expect(backToLegacy).toEqual(original);
  });

  it('should handle results across all 4 day types', () => {
    const original = buildResults([
      [0, { t1: 'success', t2: 'success', t3: 'success' }], // Day 1
      [1, { t1: 'success', t2: 'fail', t3: 'success' }], // Day 2
      [2, { t1: 'fail', t2: 'success', t3: 'fail' }], // Day 3
      [3, { t1: 'success', t2: 'success', t3: 'success' }], // Day 4
    ]);
    const generic = convertResultsToGeneric(original);
    const backToLegacy = convertResultsToLegacy(generic);

    expect(backToLegacy).toEqual(original);
  });

  it('should handle sparse results (gaps in workout indices)', () => {
    const original = buildResults([
      [0, { t1: 'success' }],
      [10, { t2: 'fail' }],
      [50, { t3: 'success', t3Reps: 25 }],
    ]);
    const generic = convertResultsToGeneric(original);
    const backToLegacy = convertResultsToLegacy(generic);

    expect(backToLegacy).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// Undo history conversion round-trip
// ---------------------------------------------------------------------------
describe('undo history conversion round-trip', () => {
  it('should round-trip empty undo history', () => {
    const original: UndoHistory = [];
    const generic = convertUndoToGeneric(original);
    const backToLegacy = convertUndoToLegacy(generic);

    expect(backToLegacy).toEqual(original);
  });

  it('should round-trip undo entries for all tiers', () => {
    const original: UndoHistory = [
      { i: 0, tier: 't1', prev: 'success' },
      { i: 1, tier: 't2', prev: 'fail' },
      { i: 2, tier: 't3', prev: undefined },
    ];
    const generic = convertUndoToGeneric(original);
    const backToLegacy = convertUndoToLegacy(generic);

    expect(backToLegacy).toEqual(original);
  });

  it('should preserve workout index across conversion', () => {
    const original: UndoHistory = [
      { i: 45, tier: 't1', prev: 'fail' },
      { i: 89, tier: 't2', prev: 'success' },
    ];
    const generic = convertUndoToGeneric(original);

    expect(generic[0].i).toBe(45);
    expect(generic[1].i).toBe(89);

    const backToLegacy = convertUndoToLegacy(generic);
    expect(backToLegacy).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// Full legacy → instance map migration
// ---------------------------------------------------------------------------
describe('convertLegacyToInstanceMap', () => {
  it('should produce a valid instance map from legacy data', () => {
    const legacy = {
      startWeights: DEFAULT_WEIGHTS,
      results: buildResults([[0, { t1: 'success', t2: 'success', t3: 'success' }]]),
      undoHistory: [{ i: 0, tier: 't1' as const, prev: undefined }],
    };

    const map = convertLegacyToInstanceMap(legacy);

    expect(map.version).toBe(1);
    expect(map.activeProgramId).toBe(GZCLP_MIGRATED_ID);
    expect(Object.keys(map.instances)).toHaveLength(1);

    const instance = map.instances[GZCLP_MIGRATED_ID];
    expect(instance.programId).toBe('gzclp');
    expect(instance.name).toBe('GZCLP');
    expect(instance.status).toBe('active');
    expect(instance.config).toEqual(DEFAULT_WEIGHTS);
  });

  it('should convert results to slot-keyed format', () => {
    const legacy = {
      startWeights: DEFAULT_WEIGHTS,
      results: buildResults([[0, { t1: 'success', t2: 'fail', t3: 'success' }]]),
      undoHistory: [] as UndoHistory,
    };

    const map = convertLegacyToInstanceMap(legacy);
    const instance = map.instances[GZCLP_MIGRATED_ID];

    // Slot-keyed: Day 1 slots are d1-t1, d1-t2, d1-t3
    expect(instance.results['0']).toBeDefined();
    expect(instance.results['0']['d1-t1']?.result).toBe('success');
    expect(instance.results['0']['d1-t2']?.result).toBe('fail');
    expect(instance.results['0']['d1-t3']?.result).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// Generic format: slot IDs are correct
// ---------------------------------------------------------------------------
describe('convertResultsToGeneric: slot ID mapping', () => {
  it('should map Day 1 tiers to d1-t1, d1-t2, d1-t3', () => {
    const results = buildResults([[0, { t1: 'success', t2: 'success', t3: 'success' }]]);
    const generic = convertResultsToGeneric(results);

    expect(generic['0']['d1-t1']?.result).toBe('success');
    expect(generic['0']['d1-t2']?.result).toBe('success');
    expect(generic['0']['d1-t3']?.result).toBe('success');
  });

  it('should map Day 2 tiers to d2-t1, d2-t2, d2-t3', () => {
    const results = buildResults([[1, { t1: 'fail', t2: 'fail', t3: 'fail' }]]);
    const generic = convertResultsToGeneric(results);

    expect(generic['1']['d2-t1']?.result).toBe('fail');
    expect(generic['1']['d2-t2']?.result).toBe('fail');
    expect(generic['1']['d2-t3']?.result).toBe('fail');
  });

  it('should map Day 3 tiers to d3-t1, d3-t2, d3-t3', () => {
    const results = buildResults([[2, { t1: 'success' }]]);
    const generic = convertResultsToGeneric(results);

    expect(generic['2']['d3-t1']?.result).toBe('success');
  });

  it('should map Day 4 tiers to d4-t1, d4-t2, d4-t3', () => {
    const results = buildResults([[3, { t2: 'fail' }]]);
    const generic = convertResultsToGeneric(results);

    expect(generic['3']['d4-t2']?.result).toBe('fail');
  });
});
