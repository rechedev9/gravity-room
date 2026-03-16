import '@/lib/sentry';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Providers } from '@/components/providers';
import { RouteErrorFallback } from '@/components/route-error-fallback';
import { RootLayout } from '@/components/root-layout';
import { AppShell } from '@/components/app-shell';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import '@/styles/globals.css';

const LoginPage = lazyWithRetry(() =>
  import('@/components/login-page').then((m) => ({ default: m.LoginPage }))
);
const PrivacyPage = lazyWithRetry(() =>
  import('@/components/privacy-page').then((m) => ({ default: m.PrivacyPage }))
);
const LandingPage = lazyWithRetry(() =>
  import('@/components/landing-page').then((m) => ({ default: m.LandingPage }))
);
const ProgramPreviewPage = lazyWithRetry(() =>
  import('@/components/program-preview-page').then((m) => ({ default: m.ProgramPreviewPage }))
);
const NotFound = lazyWithRetry(() =>
  import('@/components/not-found').then((m) => ({ default: m.NotFound }))
);

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={null}>
            <LandingPage />
          </Suspense>
        ),
      },
      { path: '/app', element: <AppShell /> },
      {
        path: '/login',
        element: (
          <Suspense fallback={null}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: '/privacy',
        element: (
          <Suspense fallback={null}>
            <PrivacyPage />
          </Suspense>
        ),
      },
      {
        path: '/programs/:programId',
        element: (
          <Suspense fallback={null}>
            <ProgramPreviewPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={null}>
            <NotFound />
          </Suspense>
        ),
      },
    ],
  },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>
);
