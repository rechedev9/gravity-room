import { lazy, Suspense } from 'react';
import { Outlet } from '@tanstack/react-router';
import { ToastProvider } from '@/contexts/toast-context';
import { CookieBanner } from '@/components/cookie-banner';
import { OfflineBanner } from '@/components/offline-banner';
import { GuestMigrationPrompt } from '@/components/guest-migration-prompt';

// Service-worker updates are useful after the first paint, but the update
// prompt and Workbox client do not belong on the initial route's critical path.
const DelayedSwUpdatePrompt = lazy(
  () =>
    new Promise<{ default: typeof import('@/components/sw-update-prompt').SwUpdatePrompt }>(
      (resolve) => {
        window.setTimeout(() => {
          void import('@/components/sw-update-prompt').then((module) =>
            resolve({ default: module.SwUpdatePrompt })
          );
        }, 1500);
      }
    )
);

export function RootLayout(): React.ReactNode {
  return (
    <ToastProvider>
      <GuestMigrationPrompt />
      <OfflineBanner />
      <Outlet />
      <CookieBanner />
      <Suspense fallback={null}>
        <DelayedSwUpdatePrompt />
      </Suspense>
    </ToastProvider>
  );
}
