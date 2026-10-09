import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useGuest } from '@/contexts/guest-context';
import {
  HomeIcon,
  TrackerIcon,
  ProgramsIcon,
  InsightsIcon,
  ExercisesIcon,
  ProfileIcon,
} from './sidebar-icons';

export interface MobilePrimaryNavItem {
  readonly to: string;
  readonly labelKey: string;
  readonly end?: boolean;
  readonly guestHidden?: boolean;
  readonly Icon: React.ComponentType<{ readonly className?: string }>;
}

/** Every top-level destination is one tap away; guests lose the account-only ones. */
export const MOBILE_PRIMARY_NAV: readonly MobilePrimaryNavItem[] = [
  { to: '/app', labelKey: 'navigation.home', end: true, Icon: HomeIcon },
  { to: '/app/tracker', labelKey: 'navigation.tracker', Icon: TrackerIcon },
  { to: '/app/insights', labelKey: 'navigation.insights', Icon: InsightsIcon, guestHidden: true },
  { to: '/app/programs', labelKey: 'navigation.programs', Icon: ProgramsIcon },
  { to: '/app/exercises', labelKey: 'navigation.exercises', Icon: ExercisesIcon },
  { to: '/app/profile', labelKey: 'navigation.profile', Icon: ProfileIcon, guestHidden: true },
];

export function MobileBottomNav(): React.ReactNode {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isGuest } = useGuest();
  const items = MOBILE_PRIMARY_NAV.filter((item) => !(item.guestHidden && isGuest));

  return (
    <nav
      aria-label={t('navigation.mobile_nav_label')}
      className="lg:hidden fixed bottom-0 inset-x-0 z-[55] border-t border-rule bg-header/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      data-testid="mobile-bottom-nav"
    >
      <ul
        className="grid max-w-lg mx-auto"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isActive = item.end
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
          const label = t(item.labelKey);

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 min-h-[52px] px-0.5 py-2 font-mono text-[9px] font-bold tracking-[0.02em] uppercase transition-colors',
                  isActive ? 'text-accent' : 'text-muted hover:text-main'
                )}
              >
                <item.Icon className={cn('w-5 h-5', isActive && 'text-accent')} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
