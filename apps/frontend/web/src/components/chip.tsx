import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ChipProps {
  readonly children: ReactNode;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly className?: string;
}

/** Pill filter chip. Mirrors the mobile Chip: quiet until selected, then it lifts to surface-2. */
export function Chip({
  children,
  selected = false,
  disabled = false,
  onClick,
  className,
}: ChipProps): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-chip border border-transparent px-3.5',
        'font-semibold text-[13px] leading-none cursor-pointer whitespace-nowrap',
        'transition-[background-color,color,transform] duration-[var(--duration-press)] ease-[var(--ease-press)]',
        'active:translate-y-px focus-visible:ring-2 ring-accent focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-35',
        selected ? 'bg-surface-2 text-main' : 'text-label hover:bg-card hover:text-main',
        className
      )}
    >
      {children}
    </button>
  );
}
