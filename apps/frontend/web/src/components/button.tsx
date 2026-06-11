import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'default' | 'primary' | 'victory' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

// Forged Iron: gold is the scarce signal. `primary`/`victory` are the gold call-to-action
// (pressed-steel inset, no glow); `default` is the line/secondary treatment (off-white,
// gold only on hover); `ghost` and `danger` keep their semantic roles.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'bg-transparent text-main border-rule-light hover:border-accent-deep hover:text-accent',
  primary:
    'bg-accent text-on-accent border-accent-hover shadow-[var(--shadow-pressed-steel)] hover:bg-accent-hover',
  victory:
    'bg-victory text-victory-on border-accent-hover shadow-[var(--shadow-pressed-steel)] hover:bg-accent-hover',
  danger: 'bg-transparent border-fail text-fail hover:bg-fail hover:text-on-accent',
  ghost: 'border-transparent text-muted hover:text-main',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2 py-2 sm:px-4 sm:py-2.5 min-h-[44px] text-[10px] sm:text-[11px]',
  md: 'px-6 py-2.5 min-h-[44px] text-[11px]',
  lg: 'w-full px-8 py-3 min-h-[48px] text-xs',
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
        'font-mono font-bold uppercase tracking-[0.14em] border rounded-[var(--radius-base)]',
        'transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]',
        'active:translate-y-px focus-visible:ring-2 ring-accent disabled:opacity-35',
        'cursor-pointer whitespace-nowrap disabled:cursor-not-allowed focus-visible:outline-none',
        'inline-flex items-center justify-center gap-2',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
    >
      {children}
    </button>
  );
});
