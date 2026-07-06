import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { GuestProvider, useGuest } from './guest-context';
import { GUEST_STORAGE_KEY } from '@/lib/guest-storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  return <GuestProvider>{children}</GuestProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests — REQ-GCTX-001: GuestProvider context availability
// ---------------------------------------------------------------------------

describe('useGuest', () => {
  it('should throw when called outside GuestProvider', () => {
    expect(() => {
      renderHook(() => useGuest());
    }).toThrow('useGuest must be used within GuestProvider');
  });
});

describe('GuestProvider', () => {
  // REQ-GCTX-001: default state
  describe('default state', () => {
    it('should have isGuest === false by default', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      expect(result.current.isGuest).toBe(false);
    });

    it('should expose enterGuestMode as a function', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      expect(typeof result.current.enterGuestMode).toBe('function');
    });

    it('should expose exitGuestMode as a function', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      expect(typeof result.current.exitGuestMode).toBe('function');
    });

    it('should expose exitGuestModeKeepingData as a function', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      expect(typeof result.current.exitGuestModeKeepingData).toBe('function');
    });
  });

  // REQ-GCTX-002: Enter guest mode
  describe('enterGuestMode', () => {
    it('should set isGuest to true', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });

      expect(result.current.isGuest).toBe(true);
    });

    it('should be idempotent when already in guest mode', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });

      act(() => {
        result.current.enterGuestMode();
      });

      expect(result.current.isGuest).toBe(true);
    });
  });

  // REQ-GCTX-003: Exit guest mode
  describe('exitGuestMode', () => {
    it('should set isGuest to false', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });

      expect(result.current.isGuest).toBe(true);

      act(() => {
        result.current.exitGuestMode();
      });

      expect(result.current.isGuest).toBe(false);
    });

    it('should be idempotent when not in guest mode', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.exitGuestMode();
      });

      expect(result.current.isGuest).toBe(false);
    });

    it('should clear any persisted guest program data', () => {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ version: 1 }));
      const { result } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });

      act(() => {
        result.current.exitGuestMode();
      });

      expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    });
  });

  // REQ-GUI-008 (new semantics): "Create Account" leaves guest mode but KEEPS
  // the guest program data so it can be migrated after sign-in.
  describe('exitGuestModeKeepingData', () => {
    it('should set isGuest to false', () => {
      const { result } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });
      expect(result.current.isGuest).toBe(true);

      act(() => {
        result.current.exitGuestModeKeepingData();
      });

      expect(result.current.isGuest).toBe(false);
    });

    it('should preserve persisted guest program data', () => {
      const stored = JSON.stringify({ version: 1 });
      localStorage.setItem(GUEST_STORAGE_KEY, stored);
      const { result } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });

      act(() => {
        result.current.exitGuestModeKeepingData();
      });

      // Guest mode flag is gone but the program data survives for migration.
      expect(result.current.isGuest).toBe(false);
      expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBe(stored);
    });

    it('does not restore guest mode after remount (flag cleared)', () => {
      const { result, unmount } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });
      act(() => {
        result.current.exitGuestModeKeepingData();
      });
      unmount();

      const remounted = renderHook(() => useGuest(), { wrapper });
      expect(remounted.result.current.isGuest).toBe(false);
    });
  });

  // REQ-GCTX-004: persistence across remounts (simulates a page reload)
  describe('persistence across reload', () => {
    it('keeps isGuest === true after the provider remounts', () => {
      const { result, unmount } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });
      expect(result.current.isGuest).toBe(true);

      unmount();

      const remounted = renderHook(() => useGuest(), { wrapper });
      expect(remounted.result.current.isGuest).toBe(true);
    });

    it('keeps isGuest === false after remount when never entered', () => {
      const { result, unmount } = renderHook(() => useGuest(), { wrapper });
      expect(result.current.isGuest).toBe(false);

      unmount();

      const remounted = renderHook(() => useGuest(), { wrapper });
      expect(remounted.result.current.isGuest).toBe(false);
    });

    it('resets to false after remount once exitGuestMode has run', () => {
      const { result, unmount } = renderHook(() => useGuest(), { wrapper });

      act(() => {
        result.current.enterGuestMode();
      });
      act(() => {
        result.current.exitGuestMode();
      });
      unmount();

      const remounted = renderHook(() => useGuest(), { wrapper });
      expect(remounted.result.current.isGuest).toBe(false);
    });
  });
});
