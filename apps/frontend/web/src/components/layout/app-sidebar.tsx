import { useCallback } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useSignOut } from '@/hooks/use-sign-out';
import { AvatarDropdown } from '@/components/layout/avatar-dropdown';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OnlineIndicator } from '@/components/online-indicator';
import { ThemeSelector } from '@/components/theme-selector';
import { cn } from '@/lib/cn';
import {
  HomeIcon,
  TrackerIcon,
  InsightsIcon,
  ProgramsIcon,
  ProfileIcon,
  ExercisesIcon,
} from './sidebar-icons';

const SIDEBAR_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-sidebar)]';

interface NavItem {
  readonly to: string;
  readonly labelKey: string;
  readonly end?: boolean;
  readonly Icon: React.ComponentType<{ readonly className?: string }>;
  readonly guestHidden?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/app', labelKey: 'navigation.home', end: true, Icon: HomeIcon },
  { to: '/app/tracker', labelKey: 'navigation.tracker', Icon: TrackerIcon },
  { to: '/app/insights', labelKey: 'navigation.insights', Icon: InsightsIcon, guestHidden: true },
  { to: '/app/programs', labelKey: 'navigation.programs', Icon: ProgramsIcon },
  { to: '/app/exercises', labelKey: 'navigation.exercises', Icon: ExercisesIcon },
  { to: '/app/profile', labelKey: 'navigation.profile', Icon: ProfileIcon, guestHidden: true },
];

function navItemClass(isActive: boolean): string {
  return cn(
    'relative flex min-h-11 items-center gap-3 px-3 py-2.5 rounded-control transition-[color,background-color] duration-[var(--duration-instant)] cursor-pointer',
    SIDEBAR_FOCUS_RING,
    isActive
      ? 'text-main bg-[var(--color-sidebar-active)]'
      : 'text-muted hover:text-main hover:bg-[var(--color-sidebar-active)]/40'
  );
}

function SidebarNavLink({ item }: { readonly item: NavItem }): React.ReactNode {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = item.end ? pathname === item.to : pathname.startsWith(item.to);

  return (
    <Link to={item.to} className={navItemClass(isActive)}>
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--color-accent)]"
          aria-hidden="true"
        />
      )}
      <item.Icon className={cn('shrink-0 size-6', isActive && 'text-accent')} />
      <span className="type-button">{t(item.labelKey)}</span>
    </Link>
  );
}

/** Desktop navigation (lg and up). Phones use the five-tab bar in MobileBottomNav. */
export function AppSidebar(): React.ReactNode {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest, exitGuestModeKeepingData } = useGuest();
  const navigate = useNavigate();
  const { signOut, failed: signOutError } = useSignOut();

  const handleGuestExit = useCallback((): void => {
    // Keep the guest data - it is migrated to the account after sign-in.
    exitGuestModeKeepingData();
    void navigate({ to: '/login' });
  }, [exitGuestModeKeepingData, navigate]);

  return (
    <aside
      className="hidden lg:flex flex-col h-screen sticky top-0 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] shrink-0 overflow-hidden"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <TooltipProvider>
        <nav aria-label={t('navigation.main_nav_label')} className="flex flex-col h-full min-h-0">
          <div className="border-b border-[var(--color-sidebar-border)] flex items-center px-5 py-4 gap-3 shrink-0">
            <Link
              to="/app"
              className={cn(
                'flex items-center gap-3 min-w-0 rounded-md hover:opacity-80 transition-opacity duration-150',
                SIDEBAR_FOCUS_RING
              )}
            >
              <img
                src="/logo-192.webp"
                alt="Gravity Room"
                width={32}
                height={32}
                className="rounded-control shrink-0"
              />
              <span className="font-display text-xl tracking-[0.06em] text-main whitespace-nowrap">
                Gravity Room
              </span>
            </Link>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1.5">
            {NAV_ITEMS.map((item) =>
              item.guestHidden && isGuest ? null : <SidebarNavLink key={item.to} item={item} />
            )}
          </div>

          <div className="border-t border-[var(--color-sidebar-border)] p-3 shrink-0">
            {isGuest ? (
              <button
                type="button"
                onClick={handleGuestExit}
                className={cn(
                  'type-button w-full min-h-11 px-3 py-2 text-left text-muted hover:text-main transition-colors cursor-pointer rounded-control',
                  SIDEBAR_FOCUS_RING
                )}
              >
                {t('auth.create_account')}
              </button>
            ) : user ? (
              <div className="space-y-2">
                <div className="flex min-w-0 items-center gap-3 rounded-control px-1 py-1">
                  <AvatarDropdown
                    user={user}
                    syncStatus="idle"
                    onSignOut={() => void signOut()}
                    dropdownPlacement="top"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="type-kicker text-label">{t('navigation.profile')}</p>
                    <p className="mt-0.5 truncate text-xs text-main" title={user.email}>
                      {user.email}
                    </p>
                  </div>
                </div>
                {signOutError && (
                  <p role="alert" className="text-xs text-error">
                    {t('auth.errors.sign_out_failed')}
                  </p>
                )}
              </div>
            ) : (
              <AvatarDropdown
                user={null}
                syncStatus="idle"
                onSignOut={() => void signOut()}
                dropdownPlacement="top"
              />
            )}
            <div className="mt-3 border-t border-[var(--color-sidebar-border)] pt-3">
              <div className="mb-2 flex min-h-6 items-center justify-between gap-2">
                <p className="type-kicker text-label">{t('theme_selector.label')}</p>
                <OnlineIndicator inline />
              </div>
              <ThemeSelector compact className="w-full" />
            </div>
          </div>
        </nav>
      </TooltipProvider>
    </aside>
  );
}
