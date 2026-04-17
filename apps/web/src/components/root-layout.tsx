import { Outlet } from '@tanstack/react-router';
import { ToastProvider } from '@/contexts/toast-context';
import { CookieBanner } from '@/components/cookie-banner';
import { OfflineBanner } from '@/components/offline-banner';
import { SwUpdatePrompt } from '@/components/sw-update-prompt';

export function RootLayout(): React.ReactNode {
  return (
    <ToastProvider>
      <OfflineBanner />
      <Outlet />
      <CookieBanner />
      <SwUpdatePrompt />
    </ToastProvider>
  );
}
