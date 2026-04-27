/**
 * use-guest-program.test.ts — Unit tests for the useGuestProgram hook.
 *
 * Tests all UseProgramReturn methods in guest (ephemeral, client-only) mode.
 * The hook fetches a ProgramDefinition from the catalog API (mocked here)
 * and manages all state in React useState.
 */
import { mock, describe, it, expect, beforeEach } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { UseProgramReturn } from '@/hooks/use-program';

// ---------------------------------------------------------------------------
// Minimal ProgramDefinition fixture (2 days, 2 slots each)
// ---------------------------------------------------------------------------

const MINIMAL_DEFINITION: ProgramDefinition = {
  id: 'test-prog',
  name: 'Test Program',
  description: 'Minimal fixture for guest hook tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 2,
  totalWorkouts: 4,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    { key: 'bench', label: 'Bench', type: 'weight', min: 20, step: 2.5 },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day B',
      slots: [
        {
          id: 'bench-t1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

const TEST_CONFIG: Record<string, number> = { squat: 60, bench: 40 };

// ---------------------------------------------------------------------------
// Mocks — mock.module must precede the import of the module under test
// ---------------------------------------------------------------------------

const mockFetchCatalogDetail = mock<(id: string) => Promise<ProgramDefinition>>(() =>
  Promise.resolve(MINIMAL_DEFINITION)
);

import { apiFunctionsStubs } from '../../test/helpers/api-functions-mock';

mock.module('@/lib/api-functions', () => ({
  ...apiFunctionsStubs,
  fetchCatalogDetail: mockFetchCatalogDetail,
}));

// Import after mocks
import { useGuestProgram } from '@/hooks/use-guest-program';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper(): React.FC<{ readonly children: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ---------------------------------------------------------------------------
// Task 4.1 — Initial state and loading (REQ-GPROG-012, REQ-GPROG-001)
// ---------------------------------------------------------------------------

describe('useGuestProgram', () => {
  beforeEach(() => {
    mockFetchCatalogDetail.mockReset();
    mockFetchCatalogDetail.mockImplementation(() => Promise.resolve(MINIMAL_DEFINITION));
  });

  describe('initial state and loading', () => {
    it('should have config === null before generateProgram is called', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.config).toBeNull();
    });

    it('should have empty rows before generateProgram is called', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.rows).toEqual([]);
    });

    it('should have activeInstanceId === null before generateProgram is called', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activeInstanceId).toBeNull();
    });

    it('should have isLoading === true while catalog query is pending', () => {
      mockFetchCatalogDetail.mockImplementation(
        () => new Promise<ProgramDefinition>(() => {}) // never resolves
      );
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('should transition isLoading to false when definition resolves', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.definition).toBeDefined();
    });

    it('should have empty undoHistory initially', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.undoHistory).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 4.2 — generateProgram (REQ-GPROG-002)
  // ---------------------------------------------------------------------------

  describe('generateProgram', () => {
    it('should set config after calling generateProgram', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      expect(result.current.config).toEqual(TEST_CONFIG);
    });

    it('should populate rows after generateProgram is called', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      expect(result.current.rows.length).toBeGreaterThan(0);
    });

    it('should set activeInstanceId to non-null after generateProgram', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      expect(result.current.activeInstanceId).not.toBeNull();
    });

    it('should be a no-op when definition is undefined', async () => {
      mockFetchCatalogDetail.mockImplementation(() => Promise.reject(new Error('Not found')));
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      expect(result.current.config).toBeNull();
    });

    it('should clear previous results when generating a new program', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      expect(result.current.undoHistory.length).toBe(1);

      await act(async () => {
        await result.current.generateProgram({ squat: 70, bench: 50 });
      });

      expect(result.current.undoHistory).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 4.3 — markResult, setAmrapReps, setRpe (REQ-GPROG-003..005, 014)
  // ---------------------------------------------------------------------------

  describe('markResult', () => {
    it('should update the results map when marking a slot', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      const row = result.current.rows.find((r) => r.index === 0);
      const slot = row?.slots.find((s) => s.slotId === 'squat-t1');

      expect(slot?.result).toBe('success');
    });

    it('should add an entry to undoHistory when marking a result', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      expect(result.current.undoHistory).toEqual([{ i: 0, slotId: 'squat-t1' }]);
    });

    it('should populate resultTimestamps when marking a result', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      expect(result.current.resultTimestamps['0']).toBeDefined();
    });

    it('should accept setLogs parameter', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success', [{ reps: 5, weight: 60 }]);
      });

      // Should not throw, undo should track it
      expect(result.current.undoHistory.length).toBe(1);
    });
  });

  describe('setAmrapReps', () => {
    it('should set amrap reps on a slot', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.setAmrapReps(0, 'squat-t1', 8);
      });

      const row = result.current.rows.find((r) => r.index === 0);
      const slot = row?.slots.find((s) => s.slotId === 'squat-t1');

      expect(slot?.amrapReps).toBe(8);
    });

    it('should clear amrap reps when called with undefined', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.setAmrapReps(0, 'squat-t1', 8);
      });

      act(() => {
        result.current.setAmrapReps(0, 'squat-t1', undefined);
      });

      const row = result.current.rows.find((r) => r.index === 0);
      const slot = row?.slots.find((s) => s.slotId === 'squat-t1');

      expect(slot?.amrapReps).toBeUndefined();
    });
  });

  describe('setRpe', () => {
    it('should set RPE value on a slot', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.setRpe(0, 'squat-t1', 7);
      });

      const row = result.current.rows.find((r) => r.index === 0);
      const slot = row?.slots.find((s) => s.slotId === 'squat-t1');

      expect(slot?.rpe).toBe(7);
    });

    it('should clear RPE when called with undefined', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.setRpe(0, 'squat-t1', 7);
      });

      act(() => {
        result.current.setRpe(0, 'squat-t1', undefined);
      });

      const row = result.current.rows.find((r) => r.index === 0);
      const slot = row?.slots.find((s) => s.slotId === 'squat-t1');

      expect(slot?.rpe).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Task 4.4 — Undo operations (REQ-GPROG-006, REQ-GPROG-007)
  // ---------------------------------------------------------------------------

  describe('undoLast', () => {
    it('should remove the last result and pop undo history', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      expect(result.current.undoHistory.length).toBe(1);

      act(() => {
        result.current.undoLast();
      });

      expect(result.current.undoHistory).toEqual([]);
    });

    it('should restore the slot to no result after undo', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      act(() => {
        result.current.undoLast();
      });

      const row = result.current.rows.find((r) => r.index === 0);
      const slot = row?.slots.find((s) => s.slotId === 'squat-t1');

      expect(slot?.result).toBeUndefined();
    });

    it('should be a no-op when undo history is empty', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      // Call undoLast with empty history — should not throw
      act(() => {
        result.current.undoLast();
      });

      expect(result.current.undoHistory).toEqual([]);
    });

    it('should undo only the last result when multiple results exist', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      act(() => {
        result.current.markResult(1, 'bench-t1', 'fail');
      });

      expect(result.current.undoHistory.length).toBe(2);

      act(() => {
        result.current.undoLast();
      });

      expect(result.current.undoHistory.length).toBe(1);
      expect(result.current.undoHistory[0]).toEqual({ i: 0, slotId: 'squat-t1' });

      // First result should still be present
      const row0 = result.current.rows.find((r) => r.index === 0);
      const slot0 = row0?.slots.find((s) => s.slotId === 'squat-t1');

      expect(slot0?.result).toBe('success');
    });
  });

  describe('undoSpecific', () => {
    it('should remove a specific slot result', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      act(() => {
        result.current.undoSpecific(0, 'squat-t1');
      });

      const row = result.current.rows.find((r) => r.index === 0);
      const slot = row?.slots.find((s) => s.slotId === 'squat-t1');

      expect(slot?.result).toBeUndefined();
    });

    it('should not throw when undoing a slot that has no result', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      // Should not throw
      act(() => {
        result.current.undoSpecific(0, 'squat-t1');
      });

      expect(result.current.rows.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 4.5 — Blocked and lifecycle operations
  // (REQ-GPROG-008..010, REQ-GPROG-013)
  // ---------------------------------------------------------------------------

  describe('exportData', () => {
    it('should be a no-op (does not throw)', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not throw
      act(() => {
        result.current.exportData();
      });

      expect(true).toBe(true);
    });
  });

  describe('importData', () => {
    it('should return false (blocked for guests)', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let importResult: boolean | undefined;

      await act(async () => {
        importResult = await result.current.importData('{}');
      });

      expect(importResult).toBe(false);
    });
  });

  describe('finishProgram', () => {
    it('should clear all state', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      await act(async () => {
        await result.current.finishProgram();
      });

      expect(result.current.config).toBeNull();
      expect(result.current.rows).toEqual([]);
      expect(result.current.undoHistory).toEqual([]);
      expect(result.current.activeInstanceId).toBeNull();
    });
  });

  describe('resetAll', () => {
    it('should clear all state to initial values', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      act(() => {
        result.current.markResult(0, 'squat-t1', 'success');
      });

      act(() => {
        result.current.resetAll();
      });

      expect(result.current.config).toBeNull();
      expect(result.current.rows).toEqual([]);
      expect(result.current.undoHistory).toEqual([]);
      expect(result.current.activeInstanceId).toBeNull();
    });

    it('should call onSuccess callback when provided', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let callbackCalled = false;

      act(() => {
        result.current.resetAll(() => {
          callbackCalled = true;
        });
      });

      expect(callbackCalled).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update config and recompute rows', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      const rowsBefore = result.current.rows;

      act(() => {
        result.current.updateConfig({ squat: 80, bench: 60 });
      });

      expect(result.current.config).toEqual({ squat: 80, bench: 60 });

      // Rows should recompute with new config (weights change)
      const rowsAfter = result.current.rows;

      expect(rowsAfter).not.toBe(rowsBefore);
    });
  });

  describe('updateConfigAsync', () => {
    it('should update config asynchronously', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.generateProgram(TEST_CONFIG);
      });

      await act(async () => {
        await result.current.updateConfigAsync({ squat: 90, bench: 70 });
      });

      expect(result.current.config).toEqual({ squat: 90, bench: 70 });
    });
  });

  describe('updateMetadata', () => {
    it('should merge metadata', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateMetadata({ note: 'test' });
      });

      expect(result.current.metadata).toEqual({ note: 'test' });
    });

    it('should merge with existing metadata', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateMetadata({ note: 'first' });
      });

      act(() => {
        result.current.updateMetadata({ extra: 'second' });
      });

      expect(result.current.metadata).toEqual({ note: 'first', extra: 'second' });
    });
  });

  // ---------------------------------------------------------------------------
  // Task 4.6 — UseProgramReturn interface conformance (REQ-GPROG-001)
  // ---------------------------------------------------------------------------

  describe('UseProgramReturn conformance', () => {
    it('should expose all expected keys from UseProgramReturn', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify all keys exist at runtime
      const expectedKeys: readonly (keyof UseProgramReturn)[] = [
        'definition',
        'config',
        'metadata',
        'rows',
        'undoHistory',
        'resultTimestamps',
        'completedDates',
        'isLoading',
        'isGenerating',
        'activeInstanceId',
        'generateProgram',
        'updateConfig',
        'updateMetadata',
        'markResult',
        'setAmrapReps',
        'setRpe',
        'undoSpecific',
        'undoLast',
        'finishProgram',
        'isFinishing',
        'resetAll',
        'exportData',
        'importData',
        'updateConfigAsync',
      ] as const;

      for (const key of expectedKeys) {
        expect(key in result.current).toBe(true);
      }
    });

    it('should have function types for all action methods', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.generateProgram).toBe('function');
      expect(typeof result.current.updateConfig).toBe('function');
      expect(typeof result.current.updateMetadata).toBe('function');
      expect(typeof result.current.markResult).toBe('function');
      expect(typeof result.current.setAmrapReps).toBe('function');
      expect(typeof result.current.setRpe).toBe('function');
      expect(typeof result.current.undoSpecific).toBe('function');
      expect(typeof result.current.undoLast).toBe('function');
      expect(typeof result.current.finishProgram).toBe('function');
      expect(typeof result.current.resetAll).toBe('function');
      expect(typeof result.current.exportData).toBe('function');
      expect(typeof result.current.importData).toBe('function');
      expect(typeof result.current.updateConfigAsync).toBe('function');
    });

    it('should satisfy UseProgramReturn at the type level (compile-time check)', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // This assignment is the compile-time check — if useGuestProgram's return
      // type drifts from UseProgramReturn, this line will cause a typecheck error.
      const _typeCheck: UseProgramReturn = result.current;

      expect(_typeCheck).toBeDefined();
    });

    it('should have isFinishing === false (guest mode never finishes async)', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useGuestProgram('test-prog'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFinishing).toBe(false);
    });
  });
});
