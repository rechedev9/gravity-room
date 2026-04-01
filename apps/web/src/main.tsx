import '@/lib/sentry';
import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Providers } from '@/components/providers';
import { RouteErrorFallback } from '@/components/route-error-fallback';
import { RootLayout } from '@/components/root-layout';
import { AppLayout } from '@/components/layout/app-layout';
import { TrackerProvider } from '@/contexts/tracker-context';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { LandingSkeleton } from '@/components/landing-skeleton';
import { LoginSkeleton } from '@/components/login-skeleton';
import { ContentPageSkeleton } from '@/components/content-page-skeleton';
import { AppSkeleton } from '@/components/app-skeleton';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';
import { ProfileSkeleton } from '@/components/profile-skeleton';
import '@/styles/globals.css';

const LoginPage = lazyWithRetry(() =>
  import('@/components/login-page').then((m) => ({ default: m.LoginPage }))
);
const PrivacyPage = lazyWithRetry(() =>
  import('@/components/privacy-page').then((m) => ({ default: m.PrivacyPage }))
);
const CookiePolicyPage = lazyWithRetry(() =>
  import('@/components/cookie-policy-page').then((m) => ({ default: m.CookiePolicyPage }))
);
const LandingPage = lazyWithRetry(() =>
  import('@/components/landing').then((m) => ({ default: m.LandingPage }))
);
const ProgramPreviewPage = lazyWithRetry(() =>
  import('@/components/program-preview-page').then((m) => ({ default: m.ProgramPreviewPage }))
);
const NotFound = lazyWithRetry(() =>
  import('@/components/not-found').then((m) => ({ default: m.NotFound }))
);
const HomePage = lazyWithRetry(() =>
  import('@/components/dashboard/home-page').then((m) => ({ default: m.HomePage }))
);
const DashboardPage = lazyWithRetry(() =>
  import('@/components/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage }))
);
const ProgramsPage = lazyWithRetry(() =>
  import('@/components/dashboard/programs-page').then((m) => ({ default: m.ProgramsPage }))
);
const TrackerPage = lazyWithRetry(() =>
  import('@/components/pages/tracker-page').then((m) => ({ default: m.TrackerPage }))
);
const ProfilePage = lazyWithRetry(() =>
  import('@/components/profile-page').then((m) => ({ default: m.ProfilePage }))
);
const AnalyticsPage = lazyWithRetry(() =>
  import('@/components/pages/analytics-page').then((m) => ({ default: m.AnalyticsPage }))
);

if (import.meta.env.VITE_PLAUSIBLE_DOMAIN) {
  const s = document.createElement('script');
  s.defer = true;
  s.dataset.domain = String(import.meta.env.VITE_PLAUSIBLE_DOMAIN);
  s.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(s);
}

function AppLayoutWithTracker(): React.ReactNode {
  return (
    <TrackerProvider>
      <AppLayout />
    </TrackerProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={<LandingSkeleton />}>
            <LandingPage />
          </Suspense>
        ),
      },
      {
        path: '/app',
        element: <AppLayoutWithTracker />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<DashboardSkeleton />}>
                <HomePage />
              </Suspense>
            ),
          },
          {
            path: 'dashboard',
            element: (
              <Suspense fallback={<DashboardSkeleton />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: 'programs',
            element: (
              <Suspense fallback={<DashboardSkeleton />}>
                <ProgramsPage />
              </Suspense>
            ),
          },
          {
            path: 'tracker/:programId?',
            element: (
              <Suspense fallback={<AppSkeleton />}>
                <TrackerPage />
              </Suspense>
            ),
          },
          {
            path: 'profile',
            element: (
              <Suspense fallback={<ProfileSkeleton />}>
                <ProfilePage />
              </Suspense>
            ),
          },
          {
            path: 'analytics',
            element: (
              <Suspense fallback={<ContentPageSkeleton />}>
                <AnalyticsPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: '/login',
        element: (
          <Suspense fallback={<LoginSkeleton />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: '/privacy',
        element: (
          <Suspense fallback={<ContentPageSkeleton />}>
            <PrivacyPage />
          </Suspense>
        ),
      },
      {
        path: '/cookies',
        element: (
          <Suspense fallback={<ContentPageSkeleton />}>
            <CookiePolicyPage />
          </Suspense>
        ),
      },
      {
        path: '/programs/:programId',
        element: (
          <Suspense fallback={<ContentPageSkeleton />}>
            <ProgramPreviewPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: (
          <Suspense fallback={<ContentPageSkeleton />}>
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
