import { useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { AvatarDropdown } from '@/components/avatar-dropdown';

interface AppSidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly end?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/app', label: 'Inicio', end: true },
  { to: '/app/tracker', label: 'Tracker' },
  { to: '/app/profile', label: 'Perfil' },
  { to: '/app/analytics', label: 'Analíticas' },
];

export function AppSidebar({ isOpen, onClose }: AppSidebarProps): React.ReactNode {
  const { user, signOut } = useAuth();
  const { isGuest, exitGuestMode } = useGuest();
  const navigate = useNavigate();

  // Close sidebar on escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return (): void => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const sidebarContent = (
    <nav
      aria-label="Navegación principal"
      className="flex flex-col h-full"
      style={{ width: 'var(--sidebar-width)' }}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[var(--color-sidebar-border)] flex items-center gap-3">
        <Link to="/app" onClick={onClose} className="flex items-center gap-3">
          <img src="/logo.webp" alt="Gravity Room" width={28} height={28} className="rounded-sm" />
          <span className="text-sm font-bold tracking-tight text-title">Gravity Room</span>
        </Link>
      </div>

      {/* Nav links */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          if (item.to === '/app/profile' && isGuest) return null;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-xs font-bold tracking-wide uppercase transition-colors rounded-none ${
                  isActive
                    ? 'text-title bg-[var(--color-sidebar-active)] border-l-2 border-accent -ml-px'
                    : 'text-muted hover:text-main hover:bg-[var(--color-sidebar-active)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          );
        })}
      </div>

      {/* User section */}
      <div className="px-4 py-4 border-t border-[var(--color-sidebar-border)]">
        {isGuest ? (
          <button
            type="button"
            onClick={() => {
              exitGuestMode();
              onClose();
              void navigate('/login');
            }}
            className="w-full px-3 py-2 text-xs font-bold text-btn-active-text bg-btn-active border-2 border-btn-ring uppercase tracking-wide cursor-pointer hover:opacity-90 transition-opacity"
          >
            Crear Cuenta
          </button>
        ) : (
          <AvatarDropdown user={user} syncStatus="idle" onSignOut={() => void signOut()} />
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside
        className="hidden lg:flex flex-col h-screen sticky top-0 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] shrink-0"
        style={{ width: 'var(--sidebar-width)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay + drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside className="relative z-10 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] h-full flex flex-col animate-[slideInFromLeft_0.2s_ease-out]">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
