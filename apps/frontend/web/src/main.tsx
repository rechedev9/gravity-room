import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { Providers } from '@/components/providers';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { initSentryDeferred } from '@/lib/sentry';
import { bootstrapTheme } from '@/lib/theme-preference';
import { stripActionTokenFromCurrentUrl } from '@/lib/action-url';
import { router } from './router';
import '@/styles/globals.css';

// Recovery links carry one-time credentials in the query string. Capture and
// remove them before Plausible, Sentry, rendering, or any asynchronous work.
stripActionTokenFromCurrentUrl();

// Paint theme + install cross-tab sync once (boot script already set data-theme;
// bootstrapTheme is idempotent when the root already matches storage).
bootstrapTheme();

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

// Defer Sentry SDK load until the browser is idle so it stays off the critical path.
const idle =
  typeof window.requestIdleCallback === 'function'
    ? (cb: () => void): void => {
        window.requestIdleCallback(cb, { timeout: 2000 });
      }
    : (cb: () => void): void => {
        window.setTimeout(cb, 1000);
      };
idle(() => {
  void initSentryDeferred();
});
