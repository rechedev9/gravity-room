import { Outlet } from '@tanstack/react-router';
import { ToastProvider } from '@/contexts/toast-context';
import { CookieBanner } from '@/components/cookie-banner';
import { OfflineBanner } from '@/components/offline-banner';
import { SwUpdatePrompt } from '@/components/sw-update-prompt';
import { useGuestMigration } from '@/hooks/use-guest-migration';

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
      <SwUpdatePrompt />
    </ToastProvider>
  );
}
