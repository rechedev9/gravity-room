import { describe, it, expect } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { GuestProvider, useGuest } from './guest-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  return <GuestProvider>{children}</GuestProvider>;
}

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
  });
});
