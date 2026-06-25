import type { ReactNode } from 'react';

/**
 * Small muscle-group glyphs for the exercise wiki index cards.
 *
 * Forged Iron: line-only, currentColor, no fills - they read as quiet wayfinding
 * marks beside each lift, never as loud coloured thumbnails. Unknown groups fall
 * back to a neutral dumbbell so the layout never breaks.
 */

interface MuscleGroupIconProps {
  readonly muscleGroupId: string;
  readonly className?: string;
}

function Frame({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}): ReactNode {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, ReactNode> = {
  // Legs - quad/hamstring silhouette
  legs: (
    <>
      <path
        d="M8 3h8l-1 7c0 3-1 5-1 11M16 10c0 3 1 5 1 11M8 3l1 7c0 3 1 5 1 11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // Chest - pec arcs
  chest: (
    <>
      <path
        d="M12 5v11M12 6c-2.2-1.5-5-1.3-7 .2 0 4 2.4 6.2 7 6.8M12 6c2.2-1.5 5-1.3 7 .2 0 4-2.4 6.2-7 6.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // Back - spine + lat sweep
  back: (
    <>
      <path
        d="M12 3v18M12 7c-3 0-6 2-7 6M12 7c3 0 6 2 7 6M12 14c-2.5 0-5 1.4-6 4M12 14c2.5 0 5 1.4 6 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};

const FALLBACK_GLYPH: ReactNode = (
  <>
    <line
      x1="6"
      y1="12"
      x2="18"
      y2="12"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <rect x="2.5" y="8.5" width="3" height="7" rx="0.9" stroke="currentColor" strokeWidth="1.75" />
    <rect x="18.5" y="8.5" width="3" height="7" rx="0.9" stroke="currentColor" strokeWidth="1.75" />
  </>
);

export function MuscleGroupIcon({ muscleGroupId, className }: MuscleGroupIconProps): ReactNode {
  return <Frame className={className}>{GLYPHS[muscleGroupId] ?? FALLBACK_GLYPH}</Frame>;
}
