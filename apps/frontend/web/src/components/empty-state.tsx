import type { ReactNode } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';
import { Button } from '@/components/button';
import { Kicker } from '@/components/kicker';
import { cn } from '@/lib/cn';

interface EmptyStateAction {
  /** Button label. Rendered mono caps by Button. */
  readonly label: string;
  /** Internal route. When set the CTA renders as a router Link. Takes precedence over onClick. */
  readonly to?: LinkProps['to'];
  /** Click handler. Used when `to` is omitted. */
  readonly onClick?: () => void;
}

interface EmptyStateProps {
  /** Optional mono uppercase wayfinding label (Kicker voice) shown above the heading. */
  readonly kicker?: ReactNode;
  /**
   * Optional small icon shown above the heading. Mutually exclusive with `kicker`
   * in practice; if both are passed the kicker renders first. Keep it small (~24-32px).
   */
  readonly icon?: ReactNode;
  /** Bebas display heading — the one-line "nothing here yet" statement. */
  readonly title: ReactNode;
  /** Optional supporting line under the heading. */
  readonly body?: ReactNode;
  /** Optional single gold primary CTA — the conversion action out of the empty state. */
  readonly action?: EmptyStateAction;
  readonly className?: string;
}

/**
 * EmptyState — the shared Forged Iron "nothing here yet" panel.
 *
 * A bordered card that vertically centres its content within its container, so it
 * reads as deliberate rather than floating at the top of a tall void. Voice mirrors
 * the home + insights empty states: optional mono kicker / small icon, a Bebas
 * display heading, a muted body line, and at most one gold primary CTA.
 *
 * The CTA is the single gold signal — never place another gold primary in the same view.
 */
export function EmptyState({
  kicker,
  icon,
  title,
  body,
  action,
  className,
}: EmptyStateProps): ReactNode {
  return (
    <div
      className={cn(
        'flex min-h-full flex-1 flex-col items-center justify-center',
        'rounded-[var(--radius-base)] border border-rule bg-card',
        'px-6 py-16 text-center sm:px-8',
        className
      )}
    >
      {kicker ? (
        <Kicker noRule className="mb-5 justify-center">
          {kicker}
        </Kicker>
      ) : null}

      {icon ? (
        <div aria-hidden className="mb-5 text-muted [&>svg]:mx-auto [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </div>
      ) : null}

      <h2 className="font-display text-4xl text-main sm:text-5xl">{title}</h2>

      {body ? <p className="mx-auto mt-3 max-w-md text-sm text-muted">{body}</p> : null}

      {action ? (
        <div className="mt-7">
          {action.to !== undefined ? (
            <Link to={action.to}>
              <Button variant="primary">{action.label}</Button>
            </Link>
          ) : (
            <Button variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
