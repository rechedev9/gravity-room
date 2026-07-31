import { lazy, Suspense } from 'react';
import { Outlet } from '@tanstack/react-router';
import { ToastProvider } from '@/contexts/toast-context';
import { CookieBanner } from '@/components/cookie-banner';
import { OfflineBanner } from '@/components/offline-banner';
import { useGuestMigration } from '@/hooks/use-guest-migration';

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

/**
 * Watches for the first authenticated session and migrates any leftover guest
 * program into the account. Rendered inside ToastProvider (so it can surface a
 * success toast) but renders no UI of its own.
 */
function GuestMigrationWatcher(): null {
  useGuestMigration();
  return null;
}

export function RootLayout(): React.ReactNode {
  return (
    <ToastProvider>
      <GuestMigrationWatcher />
      <OfflineBanner />
      <Outlet />
      <CookieBanner />
      <Suspense fallback={null}>
        <DelayedSwUpdatePrompt />
      </Suspense>
    </ToastProvider>
  );
}
