import { useState, useCallback, useEffect } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppSidebar } from './app-sidebar';
import { SidebarTrigger } from './sidebar-trigger';
import { OnlineIndicator } from '@/components/online-indicator';
import { EASE_OUT_EXPO } from '@/lib/motion-primitives';

// Typed as Record<string, string | undefined> so the lookup result is string | undefined,
// making the ?? fallback in getPageTitle semantically correct rather than dead code.
const ROUTE_LABELS: Record<string, string | undefined> = {
  '/app': 'navigation.home',
  '/app/dashboard': 'navigation.dashboard',
  '/app/tracker': 'navigation.tracker',
  '/app/programs': 'navigation.programs',
  '/app/profile': 'navigation.profile',
  '/app/analytics': 'navigation.analytics',
};

function getPageTitle(pathname: string, t: ReturnType<typeof useTranslation>['t']): string {
  // Match tracker subroutes
  if (pathname.startsWith('/app/tracker')) return t('navigation.tracker');
  const key = ROUTE_LABELS[pathname];
  return key ? t(key) : 'Gravity Room';
}

export function AppLayout(): React.ReactNode {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduced = useReducedMotion();
  const routeDuration = reduced ? 0 : 0.18;

  const closeSidebar = useCallback((): void => {
    setSidebarOpen(false);
  }, []);

  const toggleSidebar = useCallback((): void => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const pageTitle = getPageTitle(pathname, t);

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
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: routeDuration, ease: EASE_OUT_EXPO }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
