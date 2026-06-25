import { useCallback, useEffect } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { AvatarDropdown } from '@/components/layout/avatar-dropdown';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OnlineIndicator } from '@/components/online-indicator';
import { cn } from '@/lib/cn';
import { EASE_OUT_EXPO } from '@/lib/motion-primitives';
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
  // Language-specific target for public localized routes (e.g. the exercise
  // wiki lives at /ejercicios in es and /en/exercises in en).
  readonly toEn?: string;
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
  {
    to: '/ejercicios',
    toEn: '/en/exercises',
    labelKey: 'navigation.exercises',
    Icon: ExercisesIcon,
  },
  { to: '/app/profile', labelKey: 'navigation.profile', Icon: ProfileIcon, guestHidden: true },
];

interface AppSidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function navItemClass(isActive: boolean): string {
  return cn(
    'relative flex items-center gap-3 px-3 py-3 rounded-[var(--radius-base)] transition-[color,background-color] duration-[var(--duration-instant)] cursor-pointer',
    SIDEBAR_FOCUS_RING,
    isActive
      ? 'text-main bg-[var(--color-sidebar-active)]'
      : 'text-muted hover:text-main hover:bg-[var(--color-sidebar-active)]/40'
  );
}

interface SidebarNavLinkProps {
  readonly item: NavItem;
  readonly onItemClick: () => void;
}

function SidebarNavLink({ item, onItemClick }: SidebarNavLinkProps): React.ReactNode {
  const { t, i18n } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const to = item.toEn !== undefined && i18n.language.startsWith('en') ? item.toEn : item.to;
  const isActive = item.end ? pathname === to : pathname.startsWith(to);
  const label = t(item.labelKey);

  return (
    <Link to={to} onClick={onItemClick} className={navItemClass(isActive)}>
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--color-accent)]"
          aria-hidden="true"
        />
      )}
      <item.Icon className={cn('shrink-0', isActive && 'text-accent')} />
      <span className="font-mono text-[11px] font-bold tracking-[0.14em] uppercase">{label}</span>
    </Link>
  );
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps): React.ReactNode {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isGuest, exitGuestMode } = useGuest();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const drawerDuration = reduced ? 0 : 0.22;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return (): void => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll while the mobile drawer is open so the page behind it
  // (incl. any sticky tracker toolbar) can't scroll or bleed through.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return (): void => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleGuestExit = useCallback(
    (onItemClick: () => void): void => {
      exitGuestMode();
      onItemClick();
      void navigate({ to: '/login' });
    },
    [exitGuestMode, navigate]
  );

  function renderNavItems(onItemClick: () => void): React.ReactNode {
    return NAV_ITEMS.map((item) => {
      if (item.guestHidden && isGuest) return null;
      return <SidebarNavLink key={item.to} item={item} onItemClick={onItemClick} />;
    });
  }

  function renderContent(onItemClick: () => void, showClose = false): React.ReactNode {
    return (
      <TooltipProvider>
        <nav aria-label={t('navigation.main_nav_label')} className="flex flex-col h-full min-h-0">
          {/* Logo */}
          <div className="border-b border-[var(--color-sidebar-border)] flex items-center justify-between px-5 py-4 gap-3 shrink-0">
            <Link
              to="/app"
              onClick={onItemClick}
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
                className="rounded-sm shrink-0"
              />
              <span className="font-display text-xl tracking-[0.06em] text-main whitespace-nowrap">
                Gravity Room
              </span>
            </Link>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('sidebar.close_menu')}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-base)] text-muted hover:text-main hover:bg-[var(--color-sidebar-active)]/40 transition-colors cursor-pointer',
                  SIDEBAR_FOCUS_RING
                )}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Nav links */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-3">
            {renderNavItems(onItemClick)}
          </div>

          {/* User section */}
          <div className="border-t border-[var(--color-sidebar-border)] px-4 py-4 shrink-0">
            {isGuest ? (
              <button
                type="button"
                onClick={() => handleGuestExit(onItemClick)}
                className="w-full px-3 py-2 text-xs font-bold text-btn-active-text bg-btn-active border-2 border-btn-ring uppercase tracking-wide cursor-pointer hover:opacity-90 transition-opacity"
              >
                {t('auth.create_account')}
              </button>
            ) : user ? (
              <AvatarDropdown
                user={user}
                syncStatus="idle"
                onSignOut={() => void signOut()}
                dropdownPlacement="top"
              />
            ) : (
              <AvatarDropdown
                user={null}
                syncStatus="idle"
                onSignOut={() => void signOut()}
                dropdownPlacement="top"
              />
            )}
            <div className="pt-3">
              <OnlineIndicator inline />
            </div>
          </div>
        </nav>
      </TooltipProvider>
    );
  }

  return (
    <>
      {/* Desktop sidebar — fixed 224px wide, always expanded */}
      <aside
        className="hidden lg:flex flex-col h-screen sticky top-0 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] shrink-0 overflow-hidden"
        style={{ width: 'var(--sidebar-width)' }}
      >
        {renderContent(() => {})}
      </aside>

      {/* Mobile overlay + drawer — always expanded.
          z-[70] sits above any page-level sticky toolbar (the tracker toolbar is
          sticky z-50) so the page chrome can't bleed through or steal clicks. */}
      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-[70] flex">
            <motion.div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={onClose}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: drawerDuration, ease: EASE_OUT_EXPO }}
            />
            <motion.aside
              className="relative z-10 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] h-full flex flex-col"
              style={{ width: 'var(--sidebar-width)', willChange: 'transform' }}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: drawerDuration, ease: EASE_OUT_EXPO }}
            >
              {renderContent(onClose, true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
