import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'default' | 'primary' | 'victory' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'border-rule text-btn-text hover:bg-btn-active hover:text-btn-active-text',
  primary: 'bg-accent text-on-accent border-accent hover:bg-accent-hover',
  victory:
    'bg-victory text-victory-on border-victory shadow-[var(--shadow-victory)] hover:brightness-110',
  danger: 'border-fail text-fail hover:bg-fail hover:text-on-accent',
  ghost: 'border-transparent text-muted hover:text-main',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] text-[10px] sm:text-xs',
  md: 'px-4 py-2.5 min-h-[44px] text-xs',
  lg: 'w-full px-4 py-3 min-h-[48px] text-xs',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', className, children, ...rest },
  ref
): React.ReactNode {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={cn(
        'font-bold uppercase tracking-wide border-[1.5px] rounded-[var(--radius-base)]',
        'transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]',
        'active:translate-y-px focus-visible:ring-2 ring-accent disabled:opacity-35',
        'cursor-pointer whitespace-nowrap disabled:cursor-not-allowed focus-visible:outline-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
    >
      {children}
    </button>
  );
});
