interface TabIconProps {
  readonly className?: string;
}

// Outline glyphs drawn to sit beside the mobile Ionicons tab bar (barbell, calendar,
// layers, body, ellipsis): 24px grid, 1.75 stroke, round joins.
function TabSvg({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: React.ReactNode;
}): React.ReactNode {
  return (
    <svg
      width="24"
      height="24"
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

export function TrainTabIcon({ className }: TabIconProps): React.ReactNode {
  return (
    <TabSvg className={className}>
      <path d="M7 12h10" />
      <rect x="4" y="7" width="3" height="10" rx="1" />
      <rect x="17" y="7" width="3" height="10" rx="1" />
      <path d="M2 10v4M22 10v4" />
    </TabSvg>
  );
}

export function PlansTabIcon({ className }: TabIconProps): React.ReactNode {
  return (
    <TabSvg className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" />
    </TabSvg>
  );
}

export function ExploreTabIcon({ className }: TabIconProps): React.ReactNode {
  return (
    <TabSvg className={className}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 12.5 9 5 9-5" />
      <path d="m3 16.5 9 5 9-5" />
    </TabSvg>
  );
}

export function ExercisesTabIcon({ className }: TabIconProps): React.ReactNode {
  return (
    <TabSvg className={className}>
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M4 8.5c2.5 1 5 1.4 8 1.4s5.5-.4 8-1.4" />
      <path d="M12 9.9v4.1M12 14l-3 7.5M12 14l3 7.5" />
    </TabSvg>
  );
}

export function MoreTabIcon({ className }: TabIconProps): React.ReactNode {
  return (
    <TabSvg className={className}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </TabSvg>
  );
}
