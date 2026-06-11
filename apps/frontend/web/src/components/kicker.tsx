import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface KickerProps {
  /** Section/label text — rendered uppercase via CSS. */
  readonly children: ReactNode;
  /** Optional index marker (e.g. "01") shown in gold before the label. */
  readonly index?: string;
  /** Hide the trailing hairline rule that fills remaining width. */
  readonly noRule?: boolean;
  readonly className?: string;
}

/**
 * Kicker — the signature Forged Iron wayfinding label.
 * Indexed mono caps with a trailing hairline that extends to fill its row.
 * Mirrors the prototype `.k` voice: 10px JetBrains Mono, 0.22em tracking.
 */
export function Kicker({ children, index, noRule = false, className }: KickerProps): ReactNode {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-label',
        className
      )}
    >
      {index ? <span className="text-accent-deep">{index}</span> : null}
      <span>{children}</span>
      {noRule ? null : <span aria-hidden className="h-px flex-1 bg-rule" />}
    </div>
  );
}
