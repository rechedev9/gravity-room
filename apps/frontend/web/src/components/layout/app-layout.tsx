import { Outlet, useRouterState } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppSidebar } from './app-sidebar';
import { MobileBottomNav } from './mobile-bottom-nav';
import { EASE_OUT_EXPO } from '@/lib/motion-easing';

export function AppLayout(): React.ReactNode {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const reduced = useReducedMotion();
  const routeDuration = reduced ? 0 : 0.18;

  return (
    <div className="flex min-h-dvh bg-body">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* The padding reserves the phone tab bar so the last card never sits under it. */}
        <main
          className="flex-1 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] lg:pb-0"
          tabIndex={-1}
        >
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

      <MobileBottomNav />
    </div>
  );
}
