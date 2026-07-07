import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnitPreference } from './use-unit-preference';

// ---------------------------------------------------------------------------
// useUnitPreference — kg/lbs toggle persisted to localStorage
// ---------------------------------------------------------------------------

// Must match the key in use-unit-preference.ts.
const STORAGE_KEY = 'gravity-room:unit-preference';

// localStorage is cleared by the global afterEach (test/setup.ts), so each
// test starts from an empty store and seeds values BEFORE rendering.

describe('useUnitPreference', () => {
  it('defaults to kg when nothing is stored', () => {
    const { result } = renderHook(() => useUnitPreference());

    expect(result.current.unit).toBe('kg');
  });

  it('reads a stored lbs preference on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'lbs');

    const { result } = renderHook(() => useUnitPreference());

    expect(result.current.unit).toBe('lbs');
  });

  it('falls back to kg on a corrupt stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'stones');

    const { result } = renderHook(() => useUnitPreference());

    expect(result.current.unit).toBe('kg');
  });

  it('toggles to lbs and persists the choice to localStorage', () => {
    const { result } = renderHook(() => useUnitPreference());

    act(() => {
      result.current.toggleUnit();
    });

    expect(result.current.unit).toBe('lbs');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('lbs');
  });

  it('toggles back to kg and persists it', () => {
    localStorage.setItem(STORAGE_KEY, 'lbs');
    const { result } = renderHook(() => useUnitPreference());

    act(() => {
      result.current.toggleUnit();
    });

    expect(result.current.unit).toBe('kg');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('kg');
  });

  describe('toDisplay', () => {
    it('returns kg values unchanged in kg mode', () => {
      const { result } = renderHook(() => useUnitPreference());

      expect(result.current.toDisplay(100)).toBe(100);
      expect(result.current.toDisplay(62.5)).toBe(62.5);
    });

    it('converts with the 2.20462 factor rounded to 1 decimal in lbs mode', () => {
      localStorage.setItem(STORAGE_KEY, 'lbs');
      const { result } = renderHook(() => useUnitPreference());

      expect(result.current.toDisplay(100)).toBe(220.5); // 220.462 -> 220.5
      expect(result.current.toDisplay(60)).toBe(132.3); // 132.2772 -> 132.3
      expect(result.current.toDisplay(0)).toBe(0);
    });

    it('switches conversion behaviour after a toggle', () => {
      const { result } = renderHook(() => useUnitPreference());

      expect(result.current.toDisplay(100)).toBe(100);

      act(() => {
        result.current.toggleUnit();
      });

      expect(result.current.toDisplay(100)).toBe(220.5);
    });
  });
});
