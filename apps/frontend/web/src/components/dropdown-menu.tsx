import { useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_OUT_EXPO } from '@/lib/motion-primitives';
import { useClickOutside } from '@/hooks/use-click-outside';

interface DropdownMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly align?: 'left' | 'right';
  readonly placement?: 'top' | 'bottom';
  readonly children: React.ReactNode;
}

export function DropdownMenu({
  open,
  onClose,
  align = 'right',
  placement = 'bottom',
  children,
}: DropdownMenuProps): React.ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  useClickOutside(ref, onClose);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.12, ease: EASE_OUT_EXPO }}
          className={`absolute z-50 min-w-[180px] bg-card border border-rule py-1 shadow-elevated ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Reusable menu item */
interface DropdownItemProps {
  readonly onClick: () => void;
  readonly variant?: 'default' | 'danger';
  readonly children: React.ReactNode;
}

export function DropdownItem({
  onClick,
  variant = 'default',
  children,
}: DropdownItemProps): React.ReactNode {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:outline-none ${
        variant === 'danger' ? 'text-fail hover:bg-fail-bg' : 'text-main hover:bg-hover-row'
      }`}
    >
      {children}
    </button>
  );
}

/* Reusable divider */
export function DropdownDivider(): React.ReactNode {
  return <div className="my-1 border-t border-rule-light" />;
}
