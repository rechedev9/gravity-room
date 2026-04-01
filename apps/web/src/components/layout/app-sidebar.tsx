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
  ChevronLeftIcon,
  ChevronRightIcon,
} from './sidebar-icons';

const COLLAPSE_KEY = 'sidebar:collapsed';

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
  { to: '/app/profile', label: 'Perfil', Icon: ProfileIcon, guestHidden: true },
  { to: '/app/analytics', label: 'Analíticas', Icon: AnalyticsIcon },
];

interface AppSidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

function navItemClass(isActive: boolean, collapsed: boolean): string {
  return cn(
    'flex items-center py-2.5 rounded-none transition-colors cursor-pointer',
    collapsed ? 'justify-center px-0 w-10 h-10 mx-auto' : 'gap-3 px-3',
    isActive
      ? collapsed
        ? 'text-title bg-[var(--color-sidebar-active)]'
        : 'text-title bg-[var(--color-sidebar-active)] border-l-2 border-accent -ml-px'
      : 'text-muted hover:text-main hover:bg-[var(--color-sidebar-active)]'
  );
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps): React.ReactNode {
  const { user, signOut } = useAuth();
  const { isGuest, exitGuestMode } = useGuest();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return (): void => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const toggleCollapse = useCallback((): void => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

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
          <item.Icon className="shrink-0" />
          {!collapsed && (
            <span className="text-xs font-bold tracking-wide uppercase">{item.label}</span>
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
            <Link to="/app" onClick={onItemClick} className="flex items-center gap-3">
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
          <div className={`flex-1 py-4 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
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
            ) : (
              <AvatarDropdown user={user} syncStatus="idle" onSignOut={() => void signOut()} />
            )}
          </div>

          {/* Collapse toggle — desktop only */}
          <div
            className={`border-t border-[var(--color-sidebar-border)] px-2 py-2 hidden lg:flex ${
              collapsed ? 'justify-center' : 'justify-end'
            }`}
          >
            <button
              type="button"
              onClick={toggleCollapse}
              className="p-2 text-muted hover:text-main hover:bg-[var(--color-sidebar-active)] transition-colors cursor-pointer"
              aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
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
