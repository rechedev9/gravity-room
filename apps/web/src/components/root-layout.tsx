import { Outlet } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { GuestProvider } from '@/contexts/guest-context';
import { ToastProvider } from '@/contexts/toast-context';

export function RootLayout(): React.ReactNode {
  return (
    <GuestProvider>
      <AuthProvider>
        <ToastProvider>
          <Outlet />
        </ToastProvider>
      </AuthProvider>
    </GuestProvider>
  );
}
