import { useState, useCallback, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { AvatarDropdown } from '@/components/avatar-dropdown';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import {
  HomeIcon,
  DashboardIcon,
  TrackerIcon,
  ProgramsIcon,
  ProfileIcon,
  AnalyticsIcon,
} from './sidebar-icons';

const SIDEBAR_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-sidebar)]';

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly end?: boolean;
  readonly Icon: React.ComponentType<{ readonly className?: string }>;
  readonly guestHidden?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/app', label: 'Inicio', end: true, Icon: HomeIcon },
  { to: '/app/programs', label: 'Programas', Icon: ProgramsIcon },
  { to: '/app/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/app/tracker', label: 'Tracker', Icon: TrackerIcon },
  { to: '/app/analytics', label: 'Analíticas', Icon: AnalyticsIcon },
  { to: '/app/profile', label: 'Perfil', Icon: ProfileIcon, guestHidden: true },
];

interface AppSidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function navItemClass(isActive: boolean, collapsed: boolean): string {
  return cn(
    'relative flex items-center rounded-lg transition-colors duration-150 cursor-pointer',
    SIDEBAR_FOCUS_RING,
    collapsed ? 'justify-center p-0 w-11 h-11 mx-auto' : 'gap-3 px-3 py-2.5',
    isActive
      ? collapsed
        ? 'text-title bg-[var(--color-sidebar-active)]'
        : 'text-title bg-[var(--color-sidebar-active)] border-l-[3px] border-accent -ml-px'
      : 'text-muted hover:text-main hover:bg-[var(--color-sidebar-active)]'
  );
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps): React.ReactNode {
  const { user, signOut } = useAuth();
  const { isGuest, exitGuestMode } = useGuest();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const isCollapsed = !isHovered;

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

  function renderNavItems(collapsed: boolean, onItemClick: () => void): React.ReactNode {
    return NAV_ITEMS.map((item) => {
      if (item.guestHidden && isGuest) return null;
      const link = (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onItemClick}
          className={({ isActive }) => navItemClass(isActive, collapsed)}
          aria-label={collapsed ? item.label : undefined}
        >
          {({ isActive }) => (
            <>
              <item.Icon className="shrink-0" />
              {!collapsed && (
                <span className="text-xs font-bold tracking-wide uppercase">{item.label}</span>
              )}
              {collapsed && isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-[5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]"
                />
              )}
            </>
          )}
        </NavLink>
      );
      if (collapsed) {
        return (
          <Tooltip key={item.to} delayDuration={300}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      }
      return link;
    });
  }

  function renderContent(collapsed: boolean, onItemClick: () => void): React.ReactNode {
    return (
      <TooltipProvider>
        <nav aria-label="Navegación principal" className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div
            className={`py-4 border-b border-[var(--color-sidebar-border)] flex items-center ${
              collapsed ? 'justify-center px-0' : 'px-5 gap-3'
            }`}
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
                width={28}
                height={28}
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
          <div className={`flex-1 py-4 space-y-2 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
            {renderNavItems(collapsed, onItemClick)}
          </div>

          {/* User section */}
          <div
            className={`border-t border-[var(--color-sidebar-border)] ${
              collapsed ? 'px-2 py-3 flex justify-center' : 'px-4 py-4'
            }`}
          >
            {isGuest ? (
              !collapsed && (
                <button
                  type="button"
                  onClick={() => {
                    exitGuestMode();
                    onItemClick();
                    void navigate('/login');
                  }}
                  className="w-full px-3 py-2 text-xs font-bold text-btn-active-text bg-btn-active border-2 border-btn-ring uppercase tracking-wide cursor-pointer hover:opacity-90 transition-opacity"
                >
                  Crear Cuenta
                </button>
              )
            ) : collapsed ? (
              <Link
                to="/app/profile"
                onClick={onItemClick}
                className={cn(
                  'w-11 h-11 rounded-full bg-btn-active text-btn-active-text text-sm font-extrabold flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity duration-150',
                  SIDEBAR_FOCUS_RING
                )}
                aria-label="Ver perfil"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (user?.email[0] ?? 'U').toUpperCase()
                )}
              </Link>
            ) : (
              <AvatarDropdown
                user={user}
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
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className="relative z-10 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] h-full flex flex-col animate-[slideInFromLeft_0.2s_ease-out]"
            style={{ width: 'var(--sidebar-width)' }}
          >
            {renderContent(false, onClose)}
          </aside>
        </div>
      )}
    </>
  );
}
