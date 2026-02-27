import { forwardRef } from 'react';

const BASE =
  'font-bold cursor-pointer border-2 transition-all duration-150 whitespace-nowrap disabled:opacity-25 disabled:cursor-not-allowed tracking-wide uppercase focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.97]';

const VARIANT_STYLES = {
  default:
    'border-btn-ring bg-btn text-btn-text hover:bg-btn-active hover:text-btn-active-text disabled:hover:bg-btn disabled:hover:text-btn-text',
  primary: 'border-btn-ring bg-btn-active text-btn-active-text hover:opacity-90',
  danger: 'border-fail-ring bg-fail-bg text-fail hover:bg-fail hover:text-body',
  ghost: 'border-rule bg-card text-muted hover:bg-hover-row hover:text-main',
} as const;

const SIZE_STYLES = {
  sm: 'px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] text-[10px] sm:text-xs',
  md: 'px-4 py-2.5 min-h-[44px] text-xs',
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
