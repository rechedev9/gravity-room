'use client';

import { AuthProvider } from '@/contexts/auth-context';

export function Providers({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  return <AuthProvider>{children}</AuthProvider>;
}
