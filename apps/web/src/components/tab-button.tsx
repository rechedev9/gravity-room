import type { ReactNode } from 'react';

interface TabButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly onMouseEnter?: () => void;
  readonly onFocus?: () => void;
  readonly children: ReactNode;
}

export function TabButton({
  active,
  onClick,
  onMouseEnter,
  onFocus,
  children,
}: TabButtonProps): ReactNode {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      className={`font-mono px-4 sm:px-6 py-3 min-h-[44px] text-xs font-bold cursor-pointer tracking-widest uppercase transition-colors -mb-[2px] ${
        active
          ? 'border-b-2 border-[var(--fill-progress)] text-[var(--text-main)] bg-[var(--bg-card)]'
          : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
      }`}
    >
      {children}
    </button>
  );
}
