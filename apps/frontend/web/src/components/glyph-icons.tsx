import type { ReactNode } from 'react';

interface IconProps {
  readonly className?: string;
  readonly size?: number;
}

// Outline glyphs on the same 24px grid as the tab bar icons, matching the mobile Ionicons set.
function Glyph({
  className,
  size = 20,
  children,
}: IconProps & { readonly children: ReactNode }): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <path d="m6 9 6 6 6-6" />
    </Glyph>
  );
}

export function ChevronLeftIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <path d="m15 6-6 6 6 6" />
    </Glyph>
  );
}

export function ChevronRightIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <path d="m9 6 6 6-6 6" />
    </Glyph>
  );
}

export function UndoIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <path d="M10 5 4 10.5 10 16v-3.4c5 0 8 1.5 10 5.4-.6-6-4-9.6-10-9.8V5Z" />
    </Glyph>
  );
}

export function CalendarIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </Glyph>
  );
}

export function PencilIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <path d="m4 20 1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z" />
      <path d="m14.5 6 3 3" />
    </Glyph>
  );
}

export function MoreVerticalIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="19" r="1.3" fill="currentColor" />
    </Glyph>
  );
}

export function BarbellIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <path d="M7 12h10" />
      <rect x="4" y="7" width="3" height="10" rx="1" />
      <rect x="17" y="7" width="3" height="10" rx="1" />
      <path d="M2 10v4M22 10v4" />
    </Glyph>
  );
}

export function CheckIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Glyph>
  );
}

export function CrossIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Glyph>
  );
}

/** Solid disc with a knocked-out check, the "day done" mark of the day selector. */
export function CheckCircleIcon({ className, size = 16 }: IconProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm4.7 7.6a1 1 0 0 0-1.4-1.4l-4.5 4.5-2.1-2.1a1 1 0 1 0-1.4 1.4l2.8 2.8a1 1 0 0 0 1.4 0l5.2-5.2Z"
      />
    </svg>
  );
}

export function TimerIcon(props: IconProps): ReactNode {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V8.5M12 13l-3-2.5M9.5 2.5h5" />
    </Glyph>
  );
}
