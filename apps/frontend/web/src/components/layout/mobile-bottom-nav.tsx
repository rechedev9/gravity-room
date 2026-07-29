import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { HomeIcon, TrackerIcon, ProgramsIcon } from './sidebar-icons';

export interface MobilePrimaryNavItem {
  readonly to: string;
  readonly labelKey: string;
  readonly end?: boolean;
  readonly Icon: React.ComponentType<{ readonly className?: string }>;
}

/** Gym-speed destinations only — secondary pages stay behind the hamburger drawer. */
export const MOBILE_PRIMARY_NAV: readonly MobilePrimaryNavItem[] = [
  { to: '/app', labelKey: 'navigation.home', end: true, Icon: HomeIcon },
  { to: '/app/tracker', labelKey: 'navigation.tracker', Icon: TrackerIcon },
  { to: '/app/programs', labelKey: 'navigation.programs', Icon: ProgramsIcon },
];

export function MobileBottomNav(): React.ReactNode {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label={t('navigation.mobile_nav_label')}
      className="lg:hidden fixed bottom-0 inset-x-0 z-[55] border-t border-rule bg-header/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      data-testid="mobile-bottom-nav"
    >
      <ul className="grid grid-cols-3 max-w-lg mx-auto">
        {MOBILE_PRIMARY_NAV.map((item) => {
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
                  'flex flex-col items-center justify-center gap-0.5 min-h-[52px] px-2 py-2 font-mono text-[10px] font-bold tracking-[0.12em] uppercase transition-colors',
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
