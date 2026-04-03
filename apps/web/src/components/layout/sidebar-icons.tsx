interface IconProps {
  readonly className?: string;
}

function SidebarSvg({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
}): React.ReactNode {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ className }: IconProps): React.ReactNode {
  return (
    <SidebarSvg className={className}>
      <path
        d="M2.5 8.125L10 2.5L17.5 8.125V17.5H12.5V12.5H7.5V17.5H2.5V8.125Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </SidebarSvg>
  );
}

export function DashboardIcon({ className }: IconProps): React.ReactNode {
  return (
    <SidebarSvg className={className}>
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="2.5" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="11" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="2" />
    </SidebarSvg>
  );
}

export function TrackerIcon({ className }: IconProps): React.ReactNode {
  return (
    <SidebarSvg className={className}>
      <line
        x1="5"
        y1="10"
        x2="15"
        y2="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="2" y="7" width="2.5" height="6" rx="0.75" stroke="currentColor" strokeWidth="2" />
      <rect x="15" y="7" width="2.5" height="6" rx="0.75" stroke="currentColor" strokeWidth="2" />
    </SidebarSvg>
  );
}

export function ProgramsIcon({ className }: IconProps): React.ReactNode {
  return (
    <SidebarSvg className={className}>
      <rect x="3.5" y="2.5" width="13" height="15" rx="1" stroke="currentColor" strokeWidth="2" />
      <line
        x1="6.5"
        y1="7"
        x2="13.5"
        y2="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <polyline
        points="6.5,12 8.75,14.25 13.5,10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SidebarSvg>
  );
}

export function ProfileIcon({ className }: IconProps): React.ReactNode {
  return (
    <SidebarSvg className={className}>
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 17.5C3 14.462 6.134 12 10 12C13.866 12 17 14.462 17 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </SidebarSvg>
  );
}

export function AnalyticsIcon({ className }: IconProps): React.ReactNode {
  return (
    <SidebarSvg className={className}>
      <polyline
        points="2.5,15 7,9.5 11,12.5 17.5,5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="9.5" r="1.5" fill="currentColor" />
      <circle cx="11" cy="12.5" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="5" r="1.5" fill="currentColor" />
    </SidebarSvg>
  );
}

export function LoginIcon({ className }: IconProps): React.ReactNode {
  return (
    <SidebarSvg className={className}>
      <path
        d="M8.5 3.5H4.5V16.5H8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 10H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M11.5 7L14.5 10L11.5 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SidebarSvg>
  );
}
