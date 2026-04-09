import { Suspense } from 'react';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { LandingSkeleton } from '@/components/landing-skeleton';
import { LoginSkeleton } from '@/features/auth/login-skeleton';
import { ContentPageSkeleton } from '@/components/content-page-skeleton';
import { AppSkeleton } from '@/components/app-skeleton';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';
import { ProfileSkeleton } from '@/features/profile/profile-skeleton';
import { RootLayout } from '@/components/root-layout';
import { RouteErrorFallback } from '@/components/route-error-fallback';
import { AppLayout } from '@/components/layout/app-layout';
import { TrackerProvider } from '@/contexts/tracker-context';
import type { UserInfo } from '@/contexts/auth-context';

// ---------------------------------------------------------------------------
// Router context type
// ---------------------------------------------------------------------------

export interface RouterContext {
  readonly auth: {
    readonly user: UserInfo | null;
    readonly loading: boolean;
    readonly isGuest: boolean;
  };
}

// ---------------------------------------------------------------------------
// Lazy page components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// AppLayout wrapped with TrackerProvider
// ---------------------------------------------------------------------------

function AppLayoutWithTracker(): React.ReactNode {
  return (
    <TrackerProvider>
      <AppLayout />
    </TrackerProvider>
  );
}

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RouteErrorFallback,
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function LandingRoute(): React.ReactNode {
    return (
      <Suspense fallback={<LandingSkeleton />}>
        <LandingPage />
      </Suspense>
    );
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && (context.auth.user !== null || context.auth.isGuest)) {
      throw redirect({ to: '/app', replace: true });
    }
  },
  component: function LoginRoute(): React.ReactNode {
    return (
      <Suspense fallback={<LoginSkeleton />}>
        <LoginPage />
      </Suspense>
    );
  },
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: function PrivacyRoute(): React.ReactNode {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <PrivacyPage />
      </Suspense>
    );
  },
});

const cookiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cookies',
  component: function CookiesRoute(): React.ReactNode {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <CookiePolicyPage />
      </Suspense>
    );
  },
});

const programPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/programs/$programId',
  component: function ProgramPreviewRoute(): React.ReactNode {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <ProgramPreviewPage />
      </Suspense>
    );
  },
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: function NotFoundRoute(): React.ReactNode {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <NotFound />
      </Suspense>
    );
  },
});

// /app parent route — guarded
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app-layout',
  component: AppLayoutWithTracker,
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && context.auth.user === null && !context.auth.isGuest) {
      throw redirect({ to: '/login', replace: true });
    }
  },
});

const appIndexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app',
  component: function AppIndexRoute(): React.ReactNode {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <HomePage />
      </Suspense>
    );
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/dashboard',
  component: function DashboardRoute(): React.ReactNode {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardPage />
      </Suspense>
    );
  },
});

const programsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/programs',
  component: function ProgramsRoute(): React.ReactNode {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <ProgramsPage />
      </Suspense>
    );
  },
});

const trackerIndexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/tracker',
  component: function TrackerIndexRoute(): React.ReactNode {
    return (
      <Suspense fallback={<AppSkeleton />}>
        <TrackerPage />
      </Suspense>
    );
  },
});

const trackerProgramRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/tracker/$programId',
  component: function TrackerProgramRoute(): React.ReactNode {
    return (
      <Suspense fallback={<AppSkeleton />}>
        <TrackerPage />
      </Suspense>
    );
  },
});

const profileRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/profile',
  component: function ProfileRoute(): React.ReactNode {
    return (
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfilePage />
      </Suspense>
    );
  },
});

const analyticsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/analytics',
  component: function AnalyticsRoute(): React.ReactNode {
    return (
      <Suspense fallback={<ContentPageSkeleton />}>
        <AnalyticsPage />
      </Suspense>
    );
  },
});

// ---------------------------------------------------------------------------
// Route tree assembly
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  privacyRoute,
  cookiesRoute,
  programPreviewRoute,
  notFoundRoute,
  appLayoutRoute.addChildren([
    appIndexRoute,
    dashboardRoute,
    programsRoute,
    trackerIndexRoute,
    trackerProgramRoute,
    profileRoute,
    analyticsRoute,
  ]),
]);

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const router = createRouter({
  routeTree,
  context: {
    auth: {
      user: null,
      loading: true,
      isGuest: false,
    },
  },
});

// ---------------------------------------------------------------------------
// TypeScript registration
// ---------------------------------------------------------------------------

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
