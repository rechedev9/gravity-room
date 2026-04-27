import { describe, it, expect, beforeEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useDayNavigation } from './use-day-navigation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIG_A: Record<string, number | string> = { squat: 100 };
const CONFIG_B: Record<string, number | string> = { squat: 110 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDayNavigation', () => {
  beforeEach(() => {
    // Clear localStorage so getViewPreference returns the default 'detailed'
    localStorage.clear();
  });

  describe('initial state', () => {
    it('starts at 0 when config is null and nothing is pending (firstPendingIdx -1)', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: -1, config: null })
      );
      expect(result.current.selectedDayIndex).toBe(0);
    });

    it('starts at firstPendingIdx when config is available on first render', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: 3, config: CONFIG_A })
      );
      expect(result.current.selectedDayIndex).toBe(3);
    });

    it('starts at 0 when firstPendingIdx is -1 (program complete)', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: -1, config: CONFIG_A })
      );
      expect(result.current.selectedDayIndex).toBe(0);
    });
  });

  describe('config identity change resets index', () => {
    it('resets to firstPendingIdx when config changes from null to an object', () => {
      let config: Record<string, number | string> | null = null;
      // Before config loads, rows aren't ready either — firstPendingIdx is -1
      let pendingIdx = -1;

      const { result, rerender } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: pendingIdx, config })
      );

      // Initially at 0 (config is null, nothing pending)
      expect(result.current.selectedDayIndex).toBe(0);

      // Simulate config loading alongside rows
      config = CONFIG_A;
      pendingIdx = 2;
      rerender();

      expect(result.current.selectedDayIndex).toBe(2);
    });

    it('resets to new firstPendingIdx when config reference changes', () => {
      let config: Record<string, number | string> | null = CONFIG_A;
      let pendingIdx = 1;

      const { result, rerender } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: pendingIdx, config })
      );

      expect(result.current.selectedDayIndex).toBe(1);

      // User navigates to day 4
      act(() => {
        result.current.handleNextDay();
        result.current.handleNextDay();
        result.current.handleNextDay();
      });
      expect(result.current.selectedDayIndex).toBe(4);

      // Config reference changes (e.g., weight update) with new pending index
      config = CONFIG_B;
      pendingIdx = 2;
      rerender();

      expect(result.current.selectedDayIndex).toBe(2);
    });
  });

  describe('navigation', () => {
    it('handlePrevDay decrements index, bounded at 0', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: 2, config: CONFIG_A })
      );

      act(() => result.current.handlePrevDay());
      expect(result.current.selectedDayIndex).toBe(1);

      act(() => result.current.handlePrevDay());
      expect(result.current.selectedDayIndex).toBe(0);

      // Should not go below 0
      act(() => result.current.handlePrevDay());
      expect(result.current.selectedDayIndex).toBe(0);
    });

    it('handleNextDay increments index, bounded at totalWorkouts - 1', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 3, firstPendingIdx: 0, config: CONFIG_A })
      );

      act(() => result.current.handleNextDay());
      expect(result.current.selectedDayIndex).toBe(1);

      act(() => result.current.handleNextDay());
      expect(result.current.selectedDayIndex).toBe(2);

      // Should not exceed totalWorkouts - 1
      act(() => result.current.handleNextDay());
      expect(result.current.selectedDayIndex).toBe(2);
    });

    it('handleGoToCurrent jumps to firstPendingIdx', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: 2, config: CONFIG_A })
      );

      act(() => result.current.handleNextDay());
      act(() => result.current.handleNextDay());
      expect(result.current.selectedDayIndex).toBe(4);

      act(() => result.current.handleGoToCurrent());
      expect(result.current.selectedDayIndex).toBe(2);
    });

    it('handleGoToCurrent does nothing when firstPendingIdx is -1', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: -1, config: CONFIG_A })
      );

      act(() => result.current.handleNextDay());
      act(() => result.current.handleNextDay());
      const before = result.current.selectedDayIndex;

      act(() => result.current.handleGoToCurrent());
      expect(result.current.selectedDayIndex).toBe(before);
    });
  });

  describe('view mode', () => {
    it('starts as detailed when localStorage has no preference', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: 0, config: null })
      );
      expect(result.current.viewMode).toBe('detailed');
    });

    it('toggles between detailed and compact', () => {
      const { result } = renderHook(() =>
        useDayNavigation({ totalWorkouts: 5, firstPendingIdx: 0, config: null })
      );

      act(() => result.current.handleToggleView());
      expect(result.current.viewMode).toBe('compact');

      act(() => result.current.handleToggleView());
      expect(result.current.viewMode).toBe('detailed');
    });
  });
});
