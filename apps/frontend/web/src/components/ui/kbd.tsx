import { cn } from '@/lib/cn';

export interface KbdProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

/**
 * A keyboard key chip: mono text inside a 1px rule border. Used for the ⌘K hint
 * and the desktop key bar. Text stays at 12px (`text-xs`), never below 11px.
 */
export function Kbd({ children, className }: KbdProps): React.ReactNode {
  return (
    <kbd
      className={cn(
        'inline-flex items-center rounded-control border border-rule-light px-1.5 py-0.5 font-mono text-xs text-muted',
        className
      )}
    >
      {children}
    </kbd>
  );
}
