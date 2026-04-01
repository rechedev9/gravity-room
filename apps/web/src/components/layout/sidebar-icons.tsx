interface IconProps {
  readonly className?: string;
}

export function HomeIcon({ className }: IconProps): React.ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2.5 8.125L10 2.5L17.5 8.125V17.5H12.5V12.5H7.5V17.5H2.5V8.125Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardIcon({ className }: IconProps): React.ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="2.5"
        y="11"
        width="3"
        height="6.5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="8.5"
        y="6.5"
        width="3"
        height="11"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="14.5"
        y="2.5"
        width="3"
        height="15"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function TrackerIcon({ className }: IconProps): React.ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Barbell */}
      <line
        x1="5"
        y1="10"
        x2="15"
        y2="10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Left plates */}
      <rect x="2.5" y="7.5" width="2" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Right plates */}
      <rect
        x="15.5"
        y="7.5"
        width="2"
        height="5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Center grip */}
      <line
        x1="10"
        y1="8"
        x2="10"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProgramsIcon({ className }: IconProps): React.ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect x="3.5" y="2.5" width="13" height="15" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="6.5"
        y1="7"
        x2="13.5"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="6.5"
        y1="10"
        x2="13.5"
        y2="10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="6.5"
        y1="13"
        x2="10.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProfileIcon({ className }: IconProps): React.ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 17.5C3 14.462 6.134 12 10 12C13.866 12 17 14.462 17 17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AnalyticsIcon({ className }: IconProps): React.ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <polyline
        points="2.5,15 7,9.5 11,12.5 17.5,5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="14.5,5 17.5,5 17.5,8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps): React.ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <polyline
        points="12.5,5 7.5,10 12.5,15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps): React.ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <polyline
        points="7.5,5 12.5,10 7.5,15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
