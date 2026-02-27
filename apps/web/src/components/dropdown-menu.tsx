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
      className={`absolute top-full mt-1.5 z-50 min-w-[180px] bg-card border border-rule py-1 animate-[dropdown-enter_0.15s_ease-out] shadow-elevated ${
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
