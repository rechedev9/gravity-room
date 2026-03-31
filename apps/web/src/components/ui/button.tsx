import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/cn';

const BASE =
  'inline-flex items-center justify-center font-bold cursor-pointer border-2 transition-all duration-150 whitespace-nowrap disabled:opacity-25 disabled:cursor-not-allowed tracking-wide uppercase focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none active:scale-[0.97]';

const VARIANTS = {
  default:
    'border-btn-ring bg-btn text-btn-text hover:bg-btn-active hover:text-btn-active-text disabled:hover:bg-btn disabled:hover:text-btn-text',
  primary: 'border-btn-ring bg-btn-active text-btn-active-text hover:opacity-90',
  danger: 'border-fail-ring bg-fail-bg text-fail hover:bg-fail hover:text-body',
  ghost: 'border-rule bg-card text-muted hover:bg-hover-row hover:text-main',
} as const;

const SIZES = {
  sm: 'px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] text-[10px] sm:text-xs',
  md: 'px-4 py-2.5 min-h-[44px] text-xs',
  lg: 'w-full px-4 py-3 min-h-[48px] text-xs',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: keyof typeof VARIANTS;
  readonly size?: keyof typeof SIZES;
  readonly asChild?: boolean;
}

export function Button({
  variant = 'default',
  size = 'md',
  asChild = false,
  className,
  ...props
}: ButtonProps): React.ReactNode {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}
