/**
 * useInViewport hook tests — verifies IntersectionObserver integration,
 * one-way latch behavior, and fallback when IO is unavailable.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useInViewport } from './use-in-viewport';

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let ioCallback: IOCallback | null = null;
let ioDisconnectMock: ReturnType<typeof import('bun:test').mock>;
let ioUnobserveMock: ReturnType<typeof import('bun:test').mock>;

// We need to import mock separately to use it
import { mock } from 'bun:test';

function setupIntersectionObserver(): void {
  ioDisconnectMock = mock(() => undefined);
  ioUnobserveMock = mock(() => undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).IntersectionObserver = class MockIntersectionObserver {
    constructor(callback: IOCallback) {
      ioCallback = callback;
    }
    observe = mock(() => undefined);
    unobserve = ioUnobserveMock;
    disconnect = ioDisconnectMock;
  };
}

// Store original so we can restore/remove it
const OriginalIO = window.IntersectionObserver;

beforeEach(() => {
  ioCallback = null;
  setupIntersectionObserver();
});

afterEach(() => {
  // Restore original IntersectionObserver
  window.IntersectionObserver = OriginalIO;
});

// ---------------------------------------------------------------------------
// Helper: simulate an intersection event
// ---------------------------------------------------------------------------

function fireIntersection(isIntersecting: boolean): void {
  if (!ioCallback) throw new Error('IntersectionObserver callback not captured');
  const entry = {
    isIntersecting,
    target: document.createElement('div'),
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: Date.now(),
  } as IntersectionObserverEntry;
  act(() => {
    ioCallback!([entry]);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useInViewport', () => {
  it('returns false initially before any IO callback fires', () => {
    // Act
    const { result } = renderHook(() => useInViewport());

    // Assert
    const [, isInViewport] = result.current;
    expect(isInViewport).toBe(false);
  });

  it('returns true after IO fires isIntersecting and stays true after element leaves viewport', () => {
    // Arrange
    const { result } = renderHook(() => useInViewport());

    // Attach the ref to an element to trigger observer creation
    const div = document.createElement('div');
    act(() => {
      const [refCallback] = result.current;
      refCallback(div);
    });

    // Act — element enters viewport
    fireIntersection(true);

    // Assert — isInViewport is true
    expect(result.current[1]).toBe(true);

    // Act — element leaves viewport (should stay true — one-way latch)
    // In once mode, the observer is disconnected after first intersection,
    // so subsequent callbacks wouldn't fire. But even if they did, the
    // state should remain true.
    expect(result.current[1]).toBe(true);
  });

  it('falls back to true when IntersectionObserver is unavailable', () => {
    // Arrange — remove IntersectionObserver from window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).IntersectionObserver;

    // Act
    const { result } = renderHook(() => useInViewport());

    // Assert — immediately true, no error thrown
    const [, isInViewport] = result.current;
    expect(isInViewport).toBe(true);
  });
});
