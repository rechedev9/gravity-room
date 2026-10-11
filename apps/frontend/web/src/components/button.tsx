import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'default' | 'primary' | 'victory' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

// Mirrors the mobile Button: 10px radius, Barlow SemiBold 14px in sentence case, 44px tap
// target. Gold is the scarce signal: `primary`/`victory` are the solid call to action,
// `default` is the line treatment, `ghost` and `danger` keep their semantic roles.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'bg-transparent text-main border-rule-light hover:border-accent-deep hover:text-accent',
  primary: 'bg-accent text-on-accent border-accent-hover hover:bg-accent-hover',
  victory: 'bg-victory text-victory-on border-accent-hover hover:bg-accent-hover',
  danger: 'bg-transparent border-fail text-fail hover:bg-fail hover:text-on-accent',
  ghost: 'border-transparent text-muted hover:text-main',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 min-h-[44px] sm:px-4',
  md: 'px-4 py-3 min-h-[44px] sm:px-5',
  lg: 'w-full px-6 py-3 min-h-[48px]',
};

interface ButtonClassNameOptions {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string;
}

export function buttonClassName({
  variant = 'default',
  size = 'md',
  className,
}: ButtonClassNameOptions = {}): string {
  return cn(
    'type-button border rounded-control text-center',
    'transition-[transform,background-color,border-color,color] duration-[var(--duration-press)] ease-[var(--ease-press)]',
    'active:translate-y-px focus-visible:ring-2 ring-accent disabled:opacity-35',
    'cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none',
    'inline-flex items-center justify-center gap-2',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className
  );
}

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
      className={buttonClassName({ variant, size, className })}
    >
      {children}
    </button>
  );
});
