import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useViewMode } from './use-view-mode';

// ---------------------------------------------------------------------------
// useViewMode — unit tests (REQ-CVT-002, REQ-CVT-003, REQ-CVT-004)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'tracker-view';

/** Original matchMedia so we can restore it after each test. */
const originalMatchMedia = window.matchMedia;

/**
 * Creates a minimal matchMedia mock.
 * `matches` controls whether `(max-width: 768px)` matches (i.e. mobile).
 */
function stubMatchMedia(matches: boolean): void {
  window.matchMedia = mock((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: mock(),
    removeListener: mock(),
    addEventListener: mock(),
    removeEventListener: mock(),
    dispatchEvent: mock(() => true),
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('useViewMode', () => {
  describe('responsive defaults', () => {
    it('should return card when matchMedia matches (max-width: 768px) and no preference stored', () => {
      stubMatchMedia(true);

      const { result } = renderHook(() => useViewMode());

      expect(result.current.viewMode).toBe('card');
    });

    it('should return table on desktop (no match)', () => {
      stubMatchMedia(false);

      const { result } = renderHook(() => useViewMode());

      expect(result.current.viewMode).toBe('table');
    });
  });

  describe('stored preference', () => {
    it('should override mobile default when table preference is stored', () => {
      localStorage.setItem(STORAGE_KEY, 'table');
      stubMatchMedia(true);

      const { result } = renderHook(() => useViewMode());

      expect(result.current.viewMode).toBe('table');
    });

    it('should fall back to responsive default when stored value is corrupted', () => {
      localStorage.setItem(STORAGE_KEY, 'grid');
      stubMatchMedia(true);

      const { result } = renderHook(() => useViewMode());

      expect(result.current.viewMode).toBe('card');
      expect(result.current.preference).toBeNull();
    });
  });

  describe('toggle()', () => {
    it('should switch viewMode and persist to localStorage', () => {
      stubMatchMedia(false);

      const { result } = renderHook(() => useViewMode());

      expect(result.current.viewMode).toBe('table');

      act(() => {
        result.current.toggle();
      });

      expect(result.current.viewMode).toBe('card');
      expect(localStorage.getItem(STORAGE_KEY)).toBe('card');
    });
  });

  describe('setPreference(null)', () => {
    it('should remove the localStorage entry', () => {
      localStorage.setItem(STORAGE_KEY, 'card');
      stubMatchMedia(false);

      const { result } = renderHook(() => useViewMode());

      act(() => {
        result.current.setPreference(null);
      });

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(result.current.preference).toBeNull();
    });
  });
});
