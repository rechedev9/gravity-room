import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Accessible name: the button shows only a glyph. */
  readonly label: string;
  readonly children: ReactNode;
}

/** Borderless 44px glyph button, the web twin of the mobile IconButton. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, children, ...rest },
  ref
): ReactNode {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      {...rest}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted cursor-pointer',
        'transition-[background-color,color,transform] duration-[var(--duration-press)] ease-[var(--ease-press)]',
        'hover:bg-card hover:text-main active:translate-y-px',
        'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted',
        className
      )}
    >
      {children}
    </button>
  );
});
