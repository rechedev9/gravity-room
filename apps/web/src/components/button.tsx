import { forwardRef } from 'react';

const BASE =
  'font-bold cursor-pointer border-2 transition-all whitespace-nowrap disabled:opacity-25 disabled:cursor-not-allowed tracking-wide uppercase focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none';

const VARIANT_STYLES = {
  default:
    'border-[var(--btn-border)] bg-[var(--btn-bg)] text-[var(--btn-text)] hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] disabled:hover:bg-[var(--btn-bg)] disabled:hover:text-[var(--btn-text)]',
  primary:
    'border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] hover:opacity-90',
  danger:
    'border-[var(--border-badge-no)] bg-[var(--bg-badge-no)] text-[var(--text-badge-no)] hover:bg-[var(--text-badge-no)] hover:text-[var(--bg-body)]',
  ghost:
    'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-main)]',
} as const;

const SIZE_STYLES = {
  sm: 'px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] text-[9px] sm:text-[10px]',
  md: 'px-4 py-2.5 min-h-[44px] text-[10px]',
  lg: 'w-full px-4 py-3 min-h-[48px] text-xs',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: keyof typeof VARIANT_STYLES;
  readonly size?: keyof typeof SIZE_STYLES;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', className, ...props },
  ref
): React.ReactNode {
  return (
    <button
      ref={ref}
      className={`${BASE} ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className ?? ''}`}
      {...props}
    />
  );
});
