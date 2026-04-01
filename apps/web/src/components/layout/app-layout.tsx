import { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './app-sidebar';
import { SidebarTrigger } from './sidebar-trigger';
import { OnlineIndicator } from '@/components/online-indicator';

const ROUTE_LABELS: Record<string, string> = {
  '/app': 'Inicio',
  '/app/dashboard': 'Dashboard',
  '/app/tracker': 'Tracker',
  '/app/programs': 'Programas',
  '/app/profile': 'Perfil',
  '/app/analytics': 'Analíticas',
};

function getPageTitle(pathname: string): string {
  // Match tracker subroutes
  if (pathname.startsWith('/app/tracker')) return 'Tracker';
  return ROUTE_LABELS[pathname] ?? 'Gravity Room';
}

export function AppLayout(): React.ReactNode {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const closeSidebar = useCallback((): void => {
    setSidebarOpen(false);
  }, []);

  const toggleSidebar = useCallback((): void => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="flex min-h-dvh bg-body">
      <AppSidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — mobile only trigger + page title */}
        <header className="flex items-center gap-3 px-4 py-3 bg-header border-b border-rule shadow-[0_1px_8px_rgba(0,0,0,0.4)] lg:hidden sticky top-0 z-40">
          <SidebarTrigger isOpen={sidebarOpen} onToggle={toggleSidebar} />
          <span className="text-sm font-bold text-title tracking-tight">{pageTitle}</span>
        </header>

        <OnlineIndicator />

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
