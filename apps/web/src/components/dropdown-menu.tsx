import { useRef } from 'react';
import { useClickOutside } from '@/hooks/use-click-outside';

interface DropdownMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly align?: 'left' | 'right';
  readonly children: React.ReactNode;
}

export function DropdownMenu({
  open,
  onClose,
  align = 'right',
  children,
}: DropdownMenuProps): React.ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute top-full mt-1.5 z-50 min-w-[180px] bg-[var(--bg-card)] border border-[var(--border-color)] shadow-lg py-1 ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {children}
    </div>
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
      className={`w-full text-left px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none ${
        variant === 'danger'
          ? 'text-[var(--text-badge-no)] hover:bg-[var(--bg-badge-no)]'
          : 'text-[var(--text-main)] hover:bg-[var(--bg-hover-row)]'
      }`}
    >
      {children}
    </button>
  );
}

/* Reusable divider */
export function DropdownDivider(): React.ReactNode {
  return <div className="my-1 border-t border-[var(--border-light)]" />;
}
