import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface PanelProps {
  /** Header title, rendered as a Barlow 600 heading. */
  readonly title: string;
  /** Optional mono uppercase meta on the right of the header. */
  readonly meta?: string;
  /** Optional header actions, placed after the meta. */
  readonly actions?: React.ReactNode;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/**
 * A section card for the desktop shell: a header row (title + optional mono
 * uppercase meta and actions), a hairline divider, then the body. The section is
 * labelled by its heading (aria-labelledby) so it exposes an accessible region.
 */
export function Panel({ title, meta, actions, className, children }: PanelProps): React.ReactNode {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn('bg-card border border-rule rounded-card overflow-hidden', className)}
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <h2 id={titleId} className="type-title text-title">
          {title}
        </h2>
        {(meta !== undefined || actions !== undefined) && (
          <div className="flex items-center gap-3">
            {meta !== undefined && (
              <span className="type-meta font-mono uppercase text-label">{meta}</span>
            )}
            {actions}
          </div>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
