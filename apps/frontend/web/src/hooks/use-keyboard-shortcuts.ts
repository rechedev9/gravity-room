import { useRef, useEffect } from 'react';

export interface UseKeyboardShortcutsOptions {
  readonly isActive: boolean;
  readonly onSuccess: () => void;
  readonly onFail: () => void;
  readonly onUndo: () => void;
  readonly onPrevDay: () => void;
  readonly onNextDay: () => void;
  /** Dismiss the running rest countdown. No-op when nothing is counting down. */
  readonly onSkipRest?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!optionsRef.current.isActive) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!optionsRef.current.isActive) return;

      // Suppress when input/textarea/select has focus
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Space activates a focused control natively; never double-handle it.
      if (
        e.key === ' ' &&
        e.target instanceof HTMLElement &&
        e.target.closest('button, a, [role="button"]') !== null
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          optionsRef.current.onPrevDay();
          break;
        case 'ArrowRight':
          optionsRef.current.onNextDay();
          break;
        case 's':
          optionsRef.current.onSuccess();
          break;
        case 'f':
          optionsRef.current.onFail();
          break;
        case 'u':
          optionsRef.current.onUndo();
          break;
        case ' ':
          // Espacio saltar descanso (S8); Escape stays as the alias.
          e.preventDefault();
          optionsRef.current.onSkipRest?.();
          break;
        case 'Escape':
          optionsRef.current.onSkipRest?.();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [options.isActive]);
}
