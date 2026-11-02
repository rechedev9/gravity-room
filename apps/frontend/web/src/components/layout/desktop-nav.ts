import { HomeIcon, TrackerIcon, InsightsIcon, ProgramsIcon, ExercisesIcon } from './sidebar-icons';

/** One entry of the lg+ sidebar and of the ⌘K palette's "go to" section. */
export interface DesktopNavItem {
  readonly id: string;
  readonly to: string;
  readonly labelKey: string;
  readonly Icon: React.ComponentType<{ readonly className?: string }>;
  readonly isActive: (pathname: string) => boolean;
  readonly guestHidden?: boolean;
}

function under(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The five desktop sections of artboard 01. Perfil lives in the Cuenta menu.
 * Shared by AppSidebar and the command palette so the two can never drift.
 */
export const DESKTOP_NAV_ITEMS: readonly DesktopNavItem[] = [
  {
    id: 'today',
    to: '/app',
    labelKey: 'desktop_shell.nav.today',
    Icon: HomeIcon,
    isActive: (p) => p === '/app' || p === '/app/',
  },
  {
    id: 'train',
    to: '/app/tracker',
    labelKey: 'desktop_shell.nav.train',
    Icon: TrackerIcon,
    isActive: (p) => under(p, '/app/tracker') || under(p, '/app/start'),
  },
  {
    id: 'programs',
    to: '/app/programs',
    labelKey: 'desktop_shell.nav.programs',
    Icon: ProgramsIcon,
    isActive: (p) => under(p, '/app/programs') || under(p, '/app/explore'),
  },
  {
    id: 'progress',
    to: '/app/insights',
    labelKey: 'desktop_shell.nav.progress',
    Icon: InsightsIcon,
    isActive: (p) => under(p, '/app/insights'),
    guestHidden: true,
  },
  {
    id: 'exercises',
    to: '/app/exercises',
    labelKey: 'desktop_shell.nav.exercises',
    Icon: ExercisesIcon,
    isActive: (p) => under(p, '/app/exercises'),
  },
];
