interface DashboardCardProps {
  readonly title: string;
  readonly icon?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function DashboardCard({
  title,
  icon,
  action,
  className = '',
  children,
}: DashboardCardProps): React.ReactNode {
  return (
    <div className={`bg-card border border-rule shadow-card card ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted text-sm">{icon}</span>}
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
