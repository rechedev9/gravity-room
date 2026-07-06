import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToast, useToastState } from './toast-context';

// ---------------------------------------------------------------------------
// ToastProvider — queue cap, auto-dismiss timings, exit animation window
// ---------------------------------------------------------------------------

function wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  return <ToastProvider>{children}</ToastProvider>;
}

const setup = () =>
  renderHook(() => ({ dispatch: useToast(), state: useToastState() }), { wrapper });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToast / useToastState', () => {
  it('throw when used outside ToastProvider', () => {
    expect(() => renderHook(() => useToast())).toThrow(
      'useToast must be used within ToastProvider'
    );
    expect(() => renderHook(() => useToastState())).toThrow(
      'useToastState must be used within ToastProvider'
    );
  });
});

describe('ToastProvider', () => {
  it('adds a toast with default variant and exiting=false', () => {
    const { result } = setup();

    act(() => {
      result.current.dispatch.toast({ message: 'hola' });
    });

    expect(result.current.state).toHaveLength(1);
    expect(result.current.state[0]?.message).toBe('hola');
    expect(result.current.state[0]?.variant).toBe('default');
    expect(result.current.state[0]?.exiting).toBe(false);
  });

  it('keeps at most 3 toasts, evicting the oldest on the 4th', () => {
    const { result } = setup();

    act(() => {
      result.current.dispatch.toast({ message: 'one' });
      result.current.dispatch.toast({ message: 'two' });
      result.current.dispatch.toast({ message: 'three' });
      result.current.dispatch.toast({ message: 'four' });
    });

    expect(result.current.state).toHaveLength(3);
    expect(result.current.state.map((t) => t.message)).toEqual(['two', 'three', 'four']);
  });

  it('auto-dismisses a default toast after 3000ms, then removes it 200ms later', () => {
    const { result } = setup();

    act(() => {
      result.current.dispatch.toast({ message: 'bye' });
    });

    // Just before the auto-dismiss deadline nothing has changed.
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.state).toHaveLength(1);
    expect(result.current.state[0]?.exiting).toBe(false);

    // At 3000ms the toast flips to exiting (animation window)...
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state).toHaveLength(1);
    expect(result.current.state[0]?.exiting).toBe(true);

    // ...and is removed 200ms after that.
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current.state).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state).toHaveLength(0);
  });

  it('gives the pr variant a longer 5000ms auto-dismiss', () => {
    const { result } = setup();

    act(() => {
      result.current.dispatch.toast({ message: 'new PR', variant: 'pr' });
    });

    // Still fully visible past the default 3000ms (+200ms removal window).
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current.state).toHaveLength(1);
    expect(result.current.state[0]?.exiting).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state[0]?.exiting).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.state).toHaveLength(0);
  });

  it('manual dismiss marks the toast exiting immediately and removes it after 200ms', () => {
    const { result } = setup();

    act(() => {
      result.current.dispatch.toast({ message: 'dismiss me' });
    });

    const id = result.current.state[0]?.id;
    expect(id).toBeDefined();
    if (id === undefined) throw new Error('expected a toast id');

    act(() => {
      result.current.dispatch.dismiss(id);
    });
    expect(result.current.state).toHaveLength(1);
    expect(result.current.state[0]?.exiting).toBe(true);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current.state).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state).toHaveLength(0);
  });

  it('only auto-dismisses the toast whose timer fired', () => {
    const { result } = setup();

    act(() => {
      result.current.dispatch.toast({ message: 'first' });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      result.current.dispatch.toast({ message: 'second' });
    });

    // 3000ms after "first" was shown: first is gone (3000 + 200 elapsed for it
    // only after 3200), second still fully visible.
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.state.map((t) => t.message)).toEqual(['first', 'second']);
    expect(result.current.state[0]?.exiting).toBe(true);
    expect(result.current.state[1]?.exiting).toBe(false);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.state.map((t) => t.message)).toEqual(['second']);
  });
});
