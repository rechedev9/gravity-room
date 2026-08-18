import { lazy, Suspense } from 'react';
import { Outlet } from '@tanstack/react-router';
import { ToastProvider } from '@/contexts/toast-context';
import { CookieBanner } from '@/components/cookie-banner';
import { OfflineBanner } from '@/components/offline-banner';

// The guest-migration prompt only ever matters for a signed-in user who left
// guest data behind in this browser, never on a first paint. It reaches the
// guest storage reader and the program API surface, both of which parse with
// Zod, so keeping it eager pulled the Zod runtime into every page's entry
// chunk. Lazy here, it rides along with the routes that actually need it.
const GuestMigrationPrompt = lazy(() =>
  import('@/components/guest-migration-prompt').then((module) => ({
    default: module.GuestMigrationPrompt,
  }))
);

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
      <Suspense fallback={null}>
        <GuestMigrationPrompt />
      </Suspense>
      <OfflineBanner />
      <Outlet />
      <CookieBanner />
      <Suspense fallback={null}>
        <DelayedSwUpdatePrompt />
      </Suspense>
    </ToastProvider>
  );
}
