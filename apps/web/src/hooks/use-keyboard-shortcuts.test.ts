import { describe, it, expect, mock, beforeEach } from 'bun:test';
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
    onSuccess: mock(),
    onFail: mock(),
    onUndo: mock(),
    onPrevWeek: mock(),
    onNextWeek: mock(),
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

  describe('key bindings when isActive=true', () => {
    it('pressing "s" calls onSuccess', () => {
      const options = buildOptions();
      renderHook(() => useKeyboardShortcuts(options));

      fireKey('s');

      expect(options.onSuccess).toHaveBeenCalledTimes(1);
    });

    it('pressing "f" calls onFail', () => {
      const options = buildOptions();
      renderHook(() => useKeyboardShortcuts(options));

      fireKey('f');

      expect(options.onFail).toHaveBeenCalledTimes(1);
    });

    it('pressing "u" calls onUndo', () => {
      const options = buildOptions();
      renderHook(() => useKeyboardShortcuts(options));

      fireKey('u');

      expect(options.onUndo).toHaveBeenCalledTimes(1);
    });

    it('pressing "ArrowLeft" calls onPrevWeek', () => {
      const options = buildOptions();
      renderHook(() => useKeyboardShortcuts(options));

      fireKey('ArrowLeft');

      expect(options.onPrevWeek).toHaveBeenCalledTimes(1);
    });

    it('pressing "ArrowRight" calls onNextWeek', () => {
      const options = buildOptions();
      renderHook(() => useKeyboardShortcuts(options));

      fireKey('ArrowRight');

      expect(options.onNextWeek).toHaveBeenCalledTimes(1);
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
