import { useCallback } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useSignOut } from '@/hooks/use-sign-out';
import { cn } from '@/lib/cn';
import { ThemeSelector } from '@/components/theme-selector';
import { AccountMenu } from './account-menu';
import { DesktopProgramCard } from './desktop-program-card';
import { DESKTOP_NAV_ITEMS, type DesktopNavItem } from './desktop-nav';

const SIDEBAR_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-sidebar)]';

function SidebarNavLink({
  item,
  pathname,
}: {
  readonly item: DesktopNavItem;
  readonly pathname: string;
}): React.ReactNode {
  const { t } = useTranslation();
  const isActive = item.isActive(pathname);

  return (
    <Link
      to={item.to}
      data-nav-item={item.id}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex min-h-10 items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-[color,background-color] duration-[var(--duration-instant)]',
        SIDEBAR_FOCUS_RING,
        isActive
          ? 'bg-[var(--color-surface-2)] text-main'
          : 'text-muted hover:bg-[var(--color-surface-2)] hover:text-main'
      )}
    >
      {isActive && (
        <span
          className="absolute inset-y-[7px] left-0 w-[3px] rounded-[3px] bg-accent"
          aria-hidden="true"
        />
      )}
      <item.Icon className="size-[18px] shrink-0" />
      <span>{t(item.labelKey)}</span>
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleGuestExit = useCallback((): void => {
    // Keep the guest data - it is migrated to the account after sign-in.
    exitGuestModeKeepingData();
    void navigate({ to: '/login' });
  }, [exitGuestModeKeepingData, navigate]);

  const signedIn = !isGuest && user !== null;

  return (
    <aside
      className="hidden lg:flex sticky top-0 h-screen shrink-0 flex-col overflow-hidden border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)]"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <nav aria-label={t('desktop_shell.nav_label')} className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-[var(--color-sidebar-border)] px-5 pb-4 pt-[22px]">
          <Link
            to="/app"
            className={cn(
              'block rounded-md transition-opacity hover:opacity-80',
              SIDEBAR_FOCUS_RING
            )}
          >
            <span className="block font-display text-[30px] leading-[0.9] tracking-[1px] text-main">
              GRAVITY <span className="text-accent">ROOM</span>
            </span>
            <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.8px] text-label">
              {t('desktop_shell.brand_tagline')}
            </span>
          </Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3.5">
          {DESKTOP_NAV_ITEMS.map((item) =>
            item.guestHidden && isGuest ? null : (
              <SidebarNavLink key={item.id} item={item} pathname={pathname} />
            )
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 border-t border-[var(--color-sidebar-border)] p-3">
          {isGuest ? (
            <>
              <button
                type="button"
                onClick={handleGuestExit}
                className={cn(
                  'type-button min-h-11 w-full rounded-control px-3 py-2 text-left text-muted transition-colors hover:text-main cursor-pointer',
                  SIDEBAR_FOCUS_RING
                )}
              >
                {t('auth.create_account')}
              </button>
              {/* Guests have no Cuenta menu, so the theme keeps a visible control. */}
              <ThemeSelector compact className="w-full" />
            </>
          ) : user ? (
            <>
              <DesktopProgramCard enabled={signedIn} />
              <AccountMenu user={user} onSignOut={() => void signOut()} />
              {signOutError && (
                <p role="alert" className="text-xs text-error">
                  {t('auth.errors.sign_out_failed')}
                </p>
              )}
            </>
          ) : (
            <Link
              to="/login"
              className={cn(
                'type-button inline-flex min-h-11 items-center rounded-control border-2 border-btn-ring bg-btn px-3 py-2 text-btn-text transition-colors hover:bg-btn-active hover:text-btn-active-text',
                SIDEBAR_FOCUS_RING
              )}
            >
              {t('auth.sign_in')}
            </Link>
          )}
        </div>
      </nav>
    </aside>
  );
}
