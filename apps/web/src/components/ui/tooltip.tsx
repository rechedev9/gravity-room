import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: TooltipContentProps): React.ReactNode {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'bg-tooltip-bg text-tooltip-text border border-rule px-2 py-1 text-xs rounded shadow-elevated z-50',
          'data-[state=delayed-open]:animate-[tooltip-enter_var(--duration-instant)_var(--ease-standard)]',
          'data-[state=instant-open]:animate-[tooltip-enter_var(--duration-instant)_var(--ease-standard)]',
          'data-[state=closed]:animate-[tooltip-exit_var(--duration-instant)_var(--ease-standard)]',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
