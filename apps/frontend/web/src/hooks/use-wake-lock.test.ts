import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useWakeLock } from './use-wake-lock';

// ---------------------------------------------------------------------------
// useWakeLock — unit tests (REQ-PEH-001)
// ---------------------------------------------------------------------------

/**
 * Minimal WakeLockSentinel stub with a releasable flag.
 */
function createSentinelStub(): {
  sentinel: WakeLockSentinel;
  released: { value: boolean };
} {
  const released = { value: false };
  const listeners: Record<string, Array<() => void>> = {};

  const sentinel = {
    get released() {
      return released.value;
    },
    type: 'screen' as const,
    release: mock(async () => {
      released.value = true;
      listeners['release']?.forEach((fn) => fn());
    }),
    addEventListener: mock((event: string, handler: () => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(handler);
    }),
    removeEventListener: mock(),
    onrelease: null,
    dispatchEvent: mock(() => true),
  } as unknown as WakeLockSentinel;

  return { sentinel, released };
}

let originalNavigatorDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
});

afterEach(() => {
  // Restore original navigator.wakeLock
  if (originalNavigatorDescriptor) {
    Object.defineProperty(navigator, 'wakeLock', originalNavigatorDescriptor);
  } else {
    // If wakeLock didn't exist originally, delete it
    try {
      delete (navigator as unknown as Record<string, unknown>)['wakeLock'];
    } catch {
      // Some environments may not allow delete — safe to ignore
    }
  }
});

function installWakeLock(requestFn: () => Promise<WakeLockSentinel>): void {
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request: mock(requestFn) },
    writable: true,
    configurable: true,
  });
}

function removeWakeLock(): void {
  Object.defineProperty(navigator, 'wakeLock', {
    value: undefined,
    writable: true,
    configurable: true,
  });
  // Also need to remove the property entirely so `'wakeLock' in navigator` returns false
  try {
    delete (navigator as unknown as Record<string, unknown>)['wakeLock'];
  } catch {
    // Fallback if delete is not allowed
  }
}

describe('useWakeLock', () => {
  it('should call navigator.wakeLock.request("screen") when enabled=true and API supported', async () => {
    const { sentinel } = createSentinelStub();
    const requestFn = mock(async () => sentinel);
    installWakeLock(requestFn);

    renderHook(() => useWakeLock(true));

    // Let the async acquire() settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(requestFn).toHaveBeenCalledWith('screen');
  });

  it('should be a no-op when wakeLock is not in navigator', async () => {
    removeWakeLock();

    const { result } = renderHook(() => useWakeLock(true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.isSupported).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  it('should release sentinel on unmount', async () => {
    const { sentinel } = createSentinelStub();
    installWakeLock(async () => sentinel);

    const { unmount } = renderHook(() => useWakeLock(true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    unmount();

    expect(sentinel.release).toHaveBeenCalled();
  });

  it('should re-acquire after visibilitychange to visible', async () => {
    const { sentinel: sentinel1 } = createSentinelStub();
    const { sentinel: sentinel2 } = createSentinelStub();
    let callCount = 0;
    const requestFn = mock(async () => {
      callCount++;
      return callCount === 1 ? sentinel1 : sentinel2;
    });
    installWakeLock(requestFn);

    renderHook(() => useWakeLock(true));

    // Let initial acquire settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(requestFn).toHaveBeenCalledTimes(1);

    // Simulate sentinel being released (e.g., tab hidden), then visibility change back
    await act(async () => {
      await (sentinel1.release as () => Promise<void>)();
    });

    // Dispatch visibilitychange
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(requestFn).toHaveBeenCalledTimes(2);
  });

  it('should swallow rejection and emit console.warn when request throws', async () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    installWakeLock(async () => {
      throw new Error('Low battery');
    });

    renderHook(() => useWakeLock(true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(warnSpy).toHaveBeenCalled();
    const callArg = warnSpy.mock.calls[0]?.[0] as string;
    expect(callArg).toContain('Low battery');

    warnSpy.mockRestore();
  });
});
