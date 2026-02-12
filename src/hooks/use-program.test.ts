import { describe, it, expect } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useProgram } from './use-program';
import { loadData } from '@/lib/storage';
import { loadDataCompat } from '@/lib/storage-v2';
import { DEFAULT_WEIGHTS, buildStartWeights, buildStoredData } from '../../test/helpers/fixtures';
import { seedLocalStorage } from '../../test/helpers/storage-helpers';

// ---------------------------------------------------------------------------
// useProgram — integration through real localStorage + real computeProgram
// ---------------------------------------------------------------------------
describe('useProgram', () => {
  describe('initial state', () => {
    it('should start with null weights when localStorage is empty', () => {
      const { result } = renderHook(() => useProgram());

      expect(result.current.startWeights).toBeNull();
      expect(result.current.results).toEqual({});
      expect(result.current.undoHistory).toEqual([]);
    });

    it('should load existing data from localStorage on mount', () => {
      seedLocalStorage(buildStoredData());
      const { result } = renderHook(() => useProgram());

      expect(result.current.startWeights).toEqual(DEFAULT_WEIGHTS);
    });
  });

  describe('generateProgram', () => {
    it('should set start weights and clear results', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });

      expect(result.current.startWeights).toEqual(DEFAULT_WEIGHTS);
      expect(result.current.results).toEqual({});
      expect(result.current.undoHistory).toEqual([]);
    });

    it('should persist to localStorage after generate', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });

      // Wait for the effect to fire
      const stored = loadDataCompat();
      expect(stored?.startWeights).toEqual(DEFAULT_WEIGHTS);
    });
  });

  describe('markResult', () => {
    it('should record a tier result and add undo entry', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });

      act(() => {
        result.current.markResult(0, 't1', 'success');
      });

      expect(result.current.results[0]?.t1).toBe('success');
      expect(result.current.undoHistory).toHaveLength(1);
      expect(result.current.undoHistory[0]).toEqual({ i: 0, tier: 't1', prev: undefined });
    });

    it('should record multiple tier results for the same workout', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });

      act(() => {
        result.current.markResult(0, 't1', 'success');
      });
      act(() => {
        result.current.markResult(0, 't2', 'fail');
      });
      act(() => {
        result.current.markResult(0, 't3', 'success');
      });

      expect(result.current.results[0]).toEqual({
        t1: 'success',
        t2: 'fail',
        t3: 'success',
      });
      expect(result.current.undoHistory).toHaveLength(3);
    });
  });

  describe('setAmrapReps', () => {
    it('should set AMRAP reps for T1', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.markResult(0, 't1', 'success');
      });
      act(() => {
        result.current.setAmrapReps(0, 't1Reps', 8);
      });

      expect(result.current.results[0]?.t1Reps).toBe(8);
    });

    it('should clear AMRAP reps when set to undefined', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.markResult(0, 't1', 'success');
      });
      act(() => {
        result.current.setAmrapReps(0, 't1Reps', 8);
      });
      act(() => {
        result.current.setAmrapReps(0, 't1Reps', undefined);
      });

      expect(result.current.results[0]?.t1Reps).toBeUndefined();
    });
  });

  describe('undoLast', () => {
    it('should undo the last result', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.markResult(0, 't1', 'success');
      });
      act(() => {
        result.current.undoLast();
      });

      expect(result.current.results[0]?.t1).toBeUndefined();
      expect(result.current.undoHistory).toHaveLength(0);
    });

    it('should do nothing when undo history is empty', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.undoLast();
      });

      expect(result.current.results).toEqual({});
    });

    it('should restore previous value when overwriting a result', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.markResult(0, 't1', 'success');
      });
      act(() => {
        result.current.markResult(0, 't1', 'fail'); // overwrite
      });
      act(() => {
        result.current.undoLast(); // should restore to 'success'
      });

      expect(result.current.results[0]?.t1).toBe('success');
    });
  });

  describe('undoSpecific', () => {
    it('should undo a specific tier result', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.markResult(0, 't1', 'success');
      });
      act(() => {
        result.current.markResult(0, 't2', 'fail');
      });
      act(() => {
        result.current.undoSpecific(0, 't1');
      });

      expect(result.current.results[0]?.t1).toBeUndefined();
      expect(result.current.results[0]?.t2).toBe('fail'); // unchanged
    });

    it('should do nothing for a tier with no result', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.undoSpecific(0, 't1');
      });

      // No undo entry added
      expect(result.current.undoHistory).toHaveLength(0);
    });
  });

  describe('resetAll', () => {
    it('should clear all state and localStorage', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.markResult(0, 't1', 'success');
      });
      act(() => {
        result.current.resetAll();
      });

      expect(result.current.startWeights).toBeNull();
      expect(result.current.results).toEqual({});
      expect(result.current.undoHistory).toEqual([]);
      expect(loadData()).toBeNull();
    });
  });

  describe('importData', () => {
    it('should import valid export JSON', () => {
      const { result } = renderHook(() => useProgram());

      const exportJson = JSON.stringify({
        version: 3,
        exportDate: new Date().toISOString(),
        results: { 0: { t1: 'success' } },
        startWeights: DEFAULT_WEIGHTS,
        undoHistory: [],
      });

      let success = false;
      act(() => {
        success = result.current.importData(exportJson);
      });

      expect(success).toBe(true);
      expect(result.current.startWeights).toEqual(DEFAULT_WEIGHTS);
      expect(result.current.results[0]?.t1).toBe('success');
    });

    it('should reject invalid JSON', () => {
      const { result } = renderHook(() => useProgram());

      let success = true;
      act(() => {
        success = result.current.importData('not valid json');
      });

      expect(success).toBe(false);
    });
  });

  describe('updateWeights', () => {
    it('should update start weights while preserving results', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });
      act(() => {
        result.current.markResult(0, 't1', 'success');
      });

      const newWeights = buildStartWeights({ squat: 100 });
      act(() => {
        result.current.updateWeights(newWeights);
      });

      expect(result.current.startWeights?.squat).toBe(100);
      expect(result.current.results[0]?.t1).toBe('success'); // preserved
    });
  });

  describe('loadFromCloud', () => {
    it('should replace all state from cloud data', () => {
      const { result } = renderHook(() => useProgram());

      act(() => {
        result.current.generateProgram(DEFAULT_WEIGHTS);
      });

      const cloudData = buildStoredData({
        startWeights: { squat: 200 },
        results: { 0: { t1: 'fail' } },
      });

      act(() => {
        result.current.loadFromCloud(cloudData);
      });

      expect(result.current.startWeights?.squat).toBe(200);
      expect(result.current.results[0]?.t1).toBe('fail');
    });
  });
});
