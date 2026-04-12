import { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { AvatarDropdown } from '@/components/layout/avatar-dropdown';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { EASE_OUT_EXPO } from '@/lib/motion-primitives';
import { HomeIcon, TrackerIcon, ProgramsIcon, ProfileIcon, LoginIcon } from './sidebar-icons';

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
  { to: '/app/programs', labelKey: 'navigation.programs', Icon: ProgramsIcon },
  { to: '/app/tracker', labelKey: 'navigation.tracker', Icon: TrackerIcon },
  { to: '/app/profile', labelKey: 'navigation.profile', Icon: ProfileIcon, guestHidden: true },
];

interface AppSidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function navItemClass(isActive: boolean, collapsed: boolean): string {
  return cn(
    'relative flex items-center rounded-lg transition-[color,background-color,transform] duration-[var(--duration-instant)] cursor-pointer active:scale-[0.98]',
    SIDEBAR_FOCUS_RING,
    collapsed ? 'justify-center p-0 w-12 h-12 mx-auto' : 'gap-3 px-3 py-3',
    isActive
      ? collapsed
        ? 'text-title bg-[var(--color-sidebar-active)]'
        : 'text-title bg-[var(--color-sidebar-active)] border-l-[3px] border-accent -ml-px'
      : 'text-muted hover:text-main hover:bg-[var(--color-sidebar-active)]'
  );
}

interface SidebarNavLinkProps {
  readonly item: NavItem;
  readonly collapsed: boolean;
  readonly onItemClick: () => void;
}

function SidebarNavLink({ item, collapsed, onItemClick }: SidebarNavLinkProps): React.ReactNode {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = item.end ? pathname === item.to : pathname.startsWith(item.to);
  const label = t(item.labelKey);

  return (
    <Link
      to={item.to}
      onClick={onItemClick}
      className={navItemClass(isActive, collapsed)}
      aria-label={collapsed ? label : undefined}
    >
      <item.Icon className="shrink-0" />
      {!collapsed && <span className="text-xs font-bold tracking-wide uppercase">{label}</span>}
      {collapsed && isActive && (
        <span
          aria-hidden="true"
          className="absolute bottom-[5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]"
        />
      )}
    </Link>
  );
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps): React.ReactNode {
  const { user, signOut } = useAuth();
  const { isGuest, exitGuestMode } = useGuest();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const isCollapsed = !isHovered;
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

  const handleMouseEnter = useCallback((): void => setIsHovered(true), []);
  const handleMouseLeave = useCallback((): void => setIsHovered(false), []);

  const handleGuestExit = useCallback(
    (onItemClick: () => void): void => {
      exitGuestMode();
      onItemClick();
      void navigate({ to: '/login' });
    },
    [exitGuestMode, navigate]
  );

  function renderNavItems(collapsed: boolean, onItemClick: () => void): React.ReactNode {
    const { t } = useTranslation();
    return NAV_ITEMS.map((item) => {
      if (item.guestHidden && isGuest) return null;
      const label = t(item.labelKey);
      const link = (
        <SidebarNavLink key={item.to} item={item} collapsed={collapsed} onItemClick={onItemClick} />
      );
      if (collapsed) {
        return (
          <Tooltip key={item.to} delayDuration={300}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {label}
            </TooltipContent>
          </Tooltip>
        );
      }
      return link;
    });
  }

  function renderContent(collapsed: boolean, onItemClick: () => void): React.ReactNode {
    const { t } = useTranslation();

    return (
      <TooltipProvider>
        <nav
          aria-label={t('navigation.main_nav_label')}
          className="flex flex-col h-full overflow-hidden"
        >
          {/* Logo */}
          <div
            className={cn(
              'border-b border-[var(--color-sidebar-border)] flex items-center',
              collapsed ? 'justify-center px-0 py-5' : 'px-5 py-4 gap-3'
            )}
          >
            <Link
              to="/app"
              onClick={onItemClick}
              className={cn(
                'flex items-center gap-3 rounded-md hover:opacity-80 transition-opacity duration-150',
                SIDEBAR_FOCUS_RING
              )}
            >
              <img
                src="/logo.webp"
                alt="Gravity Room"
                width={32}
                height={32}
                className="rounded-sm shrink-0"
              />
              {!collapsed && (
                <span className="text-sm font-bold tracking-tight text-title whitespace-nowrap">
                  Gravity Room
                </span>
              )}
            </Link>
          </div>

          {/* Nav links */}
          <div
            className={cn(
              'flex-1 overflow-y-auto',
              collapsed ? 'py-5 space-y-7' : 'px-3 py-4 space-y-3'
            )}
          >
            {renderNavItems(collapsed, onItemClick)}
          </div>

          {/* User section */}
          <div
            className={cn(
              'border-t border-[var(--color-sidebar-border)]',
              collapsed ? 'px-3 py-5 flex justify-center' : 'px-4 py-4'
            )}
          >
            {isGuest ? (
              collapsed ? (
                <button
                  type="button"
                  onClick={() => handleGuestExit(onItemClick)}
                  className={cn(
                    'w-12 h-12 rounded-full bg-btn-active text-btn-active-text flex items-center justify-center hover:opacity-80 transition-opacity duration-150 cursor-pointer',
                    SIDEBAR_FOCUS_RING
                  )}
                  aria-label={t('auth.create_account')}
                >
                  <LoginIcon />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleGuestExit(onItemClick)}
                  className="w-full px-3 py-2 text-xs font-bold text-btn-active-text bg-btn-active border-2 border-btn-ring uppercase tracking-wide cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {t('auth.create_account')}
                </button>
              )
            ) : user ? (
              collapsed ? (
                <Link
                  to="/app/profile"
                  onClick={onItemClick}
                  className={cn(
                    'w-12 h-12 rounded-full bg-btn-active text-btn-active-text text-sm font-extrabold flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity duration-150',
                    SIDEBAR_FOCUS_RING
                  )}
                  aria-label={t('navigation.view_profile')}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (user.email[0]?.toUpperCase() ?? 'U')
                  )}
                </Link>
              ) : (
                <AvatarDropdown
                  user={user}
                  syncStatus="idle"
                  onSignOut={() => void signOut()}
                  dropdownPlacement="top"
                />
              )
            ) : collapsed ? (
              <Link
                to="/login"
                onClick={onItemClick}
                className={cn(
                  'w-12 h-12 rounded-full bg-btn-active text-btn-active-text flex items-center justify-center hover:opacity-80 transition-opacity duration-150',
                  SIDEBAR_FOCUS_RING
                )}
                aria-label={t('auth.sign_in')}
              >
                <LoginIcon />
              </Link>
            ) : (
              <AvatarDropdown
                user={null}
                syncStatus="idle"
                onSignOut={() => void signOut()}
                dropdownPlacement="top"
              />
            )}
          </div>
        </nav>
      </TooltipProvider>
    );
  }

  return (
    <>
      {/* Desktop sidebar — sticky, width transitions between collapsed/expanded */}
      <aside
        className="hidden lg:flex flex-col h-screen sticky top-0 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] shrink-0 overflow-hidden"
        style={{
          width: isCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
          transition: 'width var(--sidebar-transition)',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {renderContent(isCollapsed, () => {})}
      </aside>

      {/* Mobile overlay + drawer — always expanded */}
      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
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
              {renderContent(false, onClose)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
