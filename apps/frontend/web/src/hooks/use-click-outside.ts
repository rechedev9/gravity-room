import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Calls `onClose` when a mousedown/touchstart occurs outside the ref element,
 * or when the Escape key is pressed.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const handlePointer = (e: MouseEvent | TouchEvent): void => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);

    return (): void => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onClose]);
}
