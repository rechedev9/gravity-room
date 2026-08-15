import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';
import type { UseKeyboardShortcutsOptions } from './use-keyboard-shortcuts';

// ---------------------------------------------------------------------------
// useKeyboardShortcuts — unit tests (REQ-KS-001, REQ-KS-002, REQ-KS-003)
// ---------------------------------------------------------------------------

function buildOptions(
  overrides?: Partial<UseKeyboardShortcutsOptions>
): UseKeyboardShortcutsOptions {
  return {
    isActive: true,
    onSuccess: vi.fn(),
    onFail: vi.fn(),
    onUndo: vi.fn(),
    onPrevDay: vi.fn(),
    onNextDay: vi.fn(),
    onSkipRest: vi.fn(),
    ...overrides,
  };
}

function fireKey(key: string, target?: EventTarget): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  if (target !== undefined) {
    Object.defineProperty(event, 'target', { value: target });
  }
  document.dispatchEvent(event);
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    // Remove any lingering keydown listeners by re-creating the hook each time
  });

  const BINDINGS = [
    { key: 's', handler: 'onSuccess' },
    { key: 'f', handler: 'onFail' },
    { key: 'u', handler: 'onUndo' },
    { key: 'ArrowLeft', handler: 'onPrevDay' },
    { key: 'ArrowRight', handler: 'onNextDay' },
    { key: 'Escape', handler: 'onSkipRest' },
  ] as const satisfies readonly {
    readonly key: string;
    readonly handler: keyof UseKeyboardShortcutsOptions;
  }[];

  describe('key bindings when isActive=true', () => {
    it.each(BINDINGS)('pressing "$key" calls $handler', ({ key, handler }) => {
      const options = buildOptions();
      renderHook(() => useKeyboardShortcuts(options));

      fireKey(key);

      expect(options[handler]).toHaveBeenCalledTimes(1);
      for (const other of BINDINGS) {
        if (other.handler !== handler) expect(options[other.handler]).not.toHaveBeenCalled();
      }
    });

    it('tolerates Escape with no rest countdown running', () => {
      const options = buildOptions({ onSkipRest: undefined });
      renderHook(() => useKeyboardShortcuts(options));

      expect(() => fireKey('Escape')).not.toThrow();
    });
  });

  describe('isActive=false', () => {
    it('pressing "s" does NOT call onSuccess when isActive is false', () => {
      const options = buildOptions({ isActive: false });
      renderHook(() => useKeyboardShortcuts(options));

      fireKey('s');

      expect(options.onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('suppression when input is focused', () => {
    it('pressing "s" does NOT call onSuccess when target is an HTMLInputElement', () => {
      const options = buildOptions();
      renderHook(() => useKeyboardShortcuts(options));

      const input = document.createElement('input');
      fireKey('s', input);

      expect(options.onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes keydown listener from document on unmount', () => {
      const options = buildOptions();
      const { unmount } = renderHook(() => useKeyboardShortcuts(options));

      unmount();

      fireKey('s');

      expect(options.onSuccess).not.toHaveBeenCalled();
    });
  });
});
