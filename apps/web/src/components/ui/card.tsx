import { cn } from '@/lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly interactive?: boolean;
}

export function Card({ interactive = false, className, ...props }: CardProps): React.ReactNode {
  return (
    <div
      className={cn(
        'bg-card border border-rule card',
        interactive && 'card-interactive cursor-pointer',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return <div className={cn('px-5 py-4 border-b border-rule', className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.ReactNode {
  return <h3 className={cn('text-sm font-bold text-main', className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}
