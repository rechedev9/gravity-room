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
      className={`font-mono px-4 sm:px-6 py-3 min-h-[44px] text-xs font-bold cursor-pointer tracking-widest uppercase transition-all duration-200 -mb-[2px] relative ${
        active
          ? 'border-b-2 border-accent text-heading bg-card'
          : 'border-b-2 border-transparent text-muted hover:text-main hover:bg-card/50'
      }`}
    >
      {children}
    </button>
  );
}
