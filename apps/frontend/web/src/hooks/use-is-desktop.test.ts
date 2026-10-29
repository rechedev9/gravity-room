/**
 * useIsDesktop hook tests — verifies the lg (64rem) media query integration via
 * useSyncExternalStore, change-event updates, and the matchMedia-missing fallback.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsDesktop } from './use-is-desktop';

type ChangeListener = (event: MediaQueryListEvent) => void;

interface MockMql {
  matches: boolean;
  listeners: Set<ChangeListener>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  media: string;
}

const originalMatchMedia = window.matchMedia;
let lastQuery: string | null = null;
let mql: MockMql;

function installMatchMedia(initialMatches: boolean): MockMql {
  const instance: MockMql = {
    matches: initialMatches,
    listeners: new Set<ChangeListener>(),
    media: '',
    addEventListener: vi.fn((_: string, cb: ChangeListener) => {
      instance.listeners.add(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: ChangeListener) => {
      instance.listeners.delete(cb);
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string): MockMql => {
    lastQuery = query;
    instance.media = query;
    return instance;
  };
  return instance;
}

function fireChange(matches: boolean): void {
  act(() => {
    mql.matches = matches;
    for (const cb of mql.listeners) cb({ matches } as MediaQueryListEvent);
  });
}

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = originalMatchMedia;
  lastQuery = null;
});

describe('useIsDesktop', () => {
  it('queries the Tailwind lg breakpoint (64rem)', () => {
    mql = installMatchMedia(false);
    renderHook(() => useIsDesktop());
    expect(lastQuery).toBe('(min-width: 64rem)');
  });

  it('returns true when the lg media query matches', () => {
    mql = installMatchMedia(true);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it('returns false when the lg media query does not match', () => {
    mql = installMatchMedia(false);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it('updates when the media query fires a change event', () => {
    mql = installMatchMedia(false);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);

    fireChange(true);
    expect(result.current).toBe(true);

    fireChange(false);
    expect(result.current).toBe(false);
  });

  it('subscribes to the change event and unsubscribes on unmount', () => {
    mql = installMatchMedia(true);
    const { unmount } = renderHook(() => useIsDesktop());
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('falls back to false when matchMedia is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).matchMedia = undefined;
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });
});
