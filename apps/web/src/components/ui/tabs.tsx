import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>): React.ReactNode {
  return (
    <TabsPrimitive.List className={cn('flex border-b border-rule gap-1', className)} {...props} />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>): React.ReactNode {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'px-4 py-2.5 text-xs font-bold text-muted transition-colors cursor-pointer',
        'border-b-2 border-transparent -mb-px',
        'hover:text-main',
        'data-[state=active]:text-title data-[state=active]:border-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>): React.ReactNode {
  return (
    <TabsPrimitive.Content className={cn('focus-visible:outline-none', className)} {...props} />
  );
}
