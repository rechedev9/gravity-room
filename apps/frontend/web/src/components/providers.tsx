import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GuestProvider } from '@/contexts/guest-context';
import { AuthProvider } from '@/contexts/auth-context';
import { ErrorBoundary } from './error-boundary';
import '@/lib/i18n'; // Initialize i18n

function RootErrorFallback(): React.ReactNode {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-body p-6">
      <div className="text-center max-w-md">
        <img
          src="/error-state.webp"
          alt="Error state — damaged gravity chamber"
          width={512}
          height={279}
          className="w-full max-w-sm mx-auto mb-8 rounded-sm opacity-80"
        />
        <h1 className="text-2xl font-bold text-main mb-3">{t('error_boundary.title')}</h1>
        <p className="text-muted mb-6">{t('error_boundary.description')}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-accent text-white font-bold cursor-pointer"
        >
          {t('error_boundary.reload_button')}
        </button>
      </div>
    </div>
  );
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        // Gym users lose signal constantly. Reconnect refetches would stampede
        // the API every time the phone changes cell tower. Opt-in per query
        // (use-online-count) rather than refetching everything.
        refetchOnReconnect: false,
      },
    },
  });
}

export function Providers({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  const [queryClient] = useState(makeQueryClient);

  return (
    <ErrorBoundary fallback={<RootErrorFallback />}>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
        <QueryClientProvider client={queryClient}>
          <GuestProvider>
            <AuthProvider>{children}</AuthProvider>
          </GuestProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}
