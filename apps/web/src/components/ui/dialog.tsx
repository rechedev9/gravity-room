import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>): React.ReactNode {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 bg-black/60 backdrop-blur-sm z-50',
        'data-[state=open]:animate-[overlay-in_var(--duration-fast)_var(--ease-standard)]',
        'data-[state=closed]:animate-[overlay-out_var(--duration-instant)_var(--ease-standard)]',
        className
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>): React.ReactNode {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-0 m-auto h-fit w-full max-w-md z-50',
          'bg-card border border-rule shadow-dialog px-6 py-5',
          'data-[state=open]:animate-[modal-enter_var(--duration-fast)_var(--ease-out-expo)]',
          'data-[state=closed]:animate-[modal-exit_var(--duration-instant)_var(--ease-standard)]',
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): React.ReactNode {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-bold text-title mb-3', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>): React.ReactNode {
  return <DialogPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />;
}
