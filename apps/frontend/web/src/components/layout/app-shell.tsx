import type { ReactNode } from 'react';
import { TrackerProvider } from '@/contexts/tracker-context';
import { AppLayout } from '@/components/layout/app-layout';

/**
 * Authenticated app chrome (sidebar + header + outlet), wrapped in TrackerProvider.
 *
 * Lives in its own module so the router can lazy-load it: AppLayout/AppSidebar pull
 * in `motion/react` (~32 KB gz), and a static import here would hoist motion into the
 * eager bundle on every route — including the public landing/login that never render
 * the app chrome. Loading it lazily keeps motion off the unauthenticated critical path.
 */
export function AppShell(): ReactNode {
  return (
    <TrackerProvider>
      <AppLayout />
    </TrackerProvider>
  );
}
