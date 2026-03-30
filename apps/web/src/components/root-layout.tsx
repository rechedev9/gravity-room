import { Outlet } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { GuestProvider } from '@/contexts/guest-context';
import { ToastProvider } from '@/contexts/toast-context';
import { CookieBanner } from '@/components/cookie-banner';
import { OfflineBanner } from '@/components/offline-banner';

export function RootLayout(): React.ReactNode {
  return (
    <GuestProvider>
      <AuthProvider>
        <ToastProvider>
          <OfflineBanner />
          <Outlet />
          <CookieBanner />
        </ToastProvider>
      </AuthProvider>
    </GuestProvider>
  );
}
