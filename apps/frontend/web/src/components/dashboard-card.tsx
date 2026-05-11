import { cn } from '@/lib/cn';

interface DashboardCardProps {
  readonly title: string;
  readonly icon?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly interactive?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function DashboardCard({
  title,
  icon,
  action,
  interactive = false,
  className,
  children,
}: DashboardCardProps): React.ReactNode {
  return (
    <section
      className={cn(
        'bg-card rounded-[var(--radius-base)] shadow-[var(--shadow-card)]',
        interactive &&
          'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] hover:-translate-y-[2px]',
        className
      )}
    >
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span className="block w-6 h-px bg-accent" aria-hidden="true" />
        <h2 className="chalk-stamp flex-1">{title}</h2>
        {icon}
        {action}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}
