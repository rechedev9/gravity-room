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
import { useAuth } from '@/contexts/auth-context';
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
const LandingPageEn = lazyWithRetry(() =>
  import('@/features/landing/landing-page-en').then((m) => ({ default: m.LandingPageEn }))
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

// ---------------------------------------------------------------------------
// AppLayout wrapped with TrackerProvider
// ---------------------------------------------------------------------------

function AppLayoutWithTracker(): React.ReactNode {
  const { loading } = useAuth();
  // Show skeleton while session restore is in progress so the app chrome
  // (sidebar, header) doesn't flash before authentication is confirmed.
  if (loading) return <AppSkeleton />;
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
  pendingComponent: LandingSkeleton,
  component: LandingPage,
});

const landingEnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en',
  pendingComponent: LandingSkeleton,
  component: LandingPageEn,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: ({ context }) => {
    if (!context.auth.loading && (context.auth.user !== null || context.auth.isGuest)) {
      throw redirect({ to: '/app', replace: true });
    }
  },
  pendingComponent: LoginSkeleton,
  component: LoginPage,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  pendingComponent: ContentPageSkeleton,
  component: PrivacyPage,
});

const cookiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cookies',
  pendingComponent: ContentPageSkeleton,
  component: CookiePolicyPage,
});

const programPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/programs/$programId',
  pendingComponent: ContentPageSkeleton,
  component: ProgramPreviewPage,
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  pendingComponent: ContentPageSkeleton,
  component: NotFound,
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
  pendingComponent: DashboardSkeleton,
  component: HomePage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/dashboard',
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
});

const programsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/programs',
  pendingComponent: DashboardSkeleton,
  component: ProgramsPage,
});

const trackerIndexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/tracker',
  pendingComponent: AppSkeleton,
  component: TrackerPage,
});

const trackerProgramRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/tracker/$programId',
  pendingComponent: AppSkeleton,
  component: TrackerPage,
});

const profileRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/profile',
  pendingComponent: ProfileSkeleton,
  component: ProfilePage,
});

// ---------------------------------------------------------------------------
// Route tree assembly
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  landingRoute,
  landingEnRoute,
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
  // Skeleton debounce: only show pendingComponent if lazy chunk takes >200 ms.
  // Activated in Fase 4 — each route now uses pendingComponent, not inline <Suspense>.
  defaultPendingMs: 200,
  defaultPendingMinMs: 400,
});

// ---------------------------------------------------------------------------
// TypeScript registration
// ---------------------------------------------------------------------------

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
