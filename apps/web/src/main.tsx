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
import { LoginSkeleton } from '@/features/auth/login-skeleton';
import { ContentPageSkeleton } from '@/components/content-page-skeleton';
import { AppSkeleton } from '@/components/app-skeleton';
import { DashboardSkeleton } from '@/features/legacy-shell/dashboard-skeleton';
import { ProfileSkeleton } from '@/features/profile/profile-skeleton';
import '@/styles/globals.css';

const LoginPage = lazyWithRetry(() =>
  import('@/features/auth/login-page').then((m) => ({ default: m.LoginPage }))
);
const PrivacyPage = lazyWithRetry(() =>
  import('@/features/legal/privacy-page').then((m) => ({ default: m.PrivacyPage }))
);
const CookiePolicyPage = lazyWithRetry(() =>
  import('@/features/legal/cookie-policy-page').then((m) => ({ default: m.CookiePolicyPage }))
);
const LandingPage = lazyWithRetry(() =>
  import('@/features/landing').then((m) => ({ default: m.LandingPage }))
);
const ProgramPreviewPage = lazyWithRetry(() =>
  import('@/features/program-preview/program-preview-page').then((m) => ({
    default: m.ProgramPreviewPage,
  }))
);
const NotFound = lazyWithRetry(() =>
  import('@/features/not-found/not-found').then((m) => ({ default: m.NotFound }))
);
const HomePage = lazyWithRetry(() =>
  import('@/features/home/home-page').then((m) => ({ default: m.HomePage }))
);
const DashboardPage = lazyWithRetry(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage }))
);
const ProgramsPage = lazyWithRetry(() =>
  import('@/features/programs/programs-page').then((m) => ({ default: m.ProgramsPage }))
);
const TrackerPage = lazyWithRetry(() =>
  import('@/features/tracker/tracker-page').then((m) => ({ default: m.TrackerPage }))
);
const ProfilePage = lazyWithRetry(() =>
  import('@/features/profile/profile-page').then((m) => ({ default: m.ProfilePage }))
);
const AnalyticsPage = lazyWithRetry(() =>
  import('@/features/analytics/analytics-page').then((m) => ({ default: m.AnalyticsPage }))
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
