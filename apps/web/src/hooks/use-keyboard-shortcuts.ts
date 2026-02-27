import { useRef, useEffect } from 'react';

export interface UseKeyboardShortcutsOptions {
  readonly isActive: boolean;
  readonly onSuccess: () => void;
  readonly onFail: () => void;
  readonly onUndo: () => void;
  readonly onPrevWeek: () => void;
  readonly onNextWeek: () => void;
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

      switch (e.key) {
        case 'ArrowLeft':
          optionsRef.current.onPrevWeek();
          break;
        case 'ArrowRight':
          optionsRef.current.onNextWeek();
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
