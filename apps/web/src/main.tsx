import '@/lib/sentry';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { Providers } from '@/components/providers';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { router } from './router';
import '@/styles/globals.css';

if (import.meta.env.VITE_PLAUSIBLE_DOMAIN) {
  const s = document.createElement('script');
  s.defer = true;
  s.dataset.domain = String(import.meta.env.VITE_PLAUSIBLE_DOMAIN);
  s.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(s);
}

function RouterShell(): React.ReactNode {
  const { user, loading } = useAuth();
  const { isGuest } = useGuest();

  return <RouterProvider router={router} context={{ auth: { user, loading, isGuest } }} />;
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <Providers>
      <RouterShell />
    </Providers>
  </StrictMode>
);
