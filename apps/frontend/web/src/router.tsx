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
const ProgramsPage = lazyWithRetry(() =>
  import('@/features/programs/programs-page').then((m) => ({ default: m.ProgramsPage }))
);
const TrackerPage = lazyWithRetry(() =>
  import('@/features/tracker/tracker-page').then((m) => ({ default: m.TrackerPage }))
);
const ProfilePage = lazyWithRetry(() =>
  import('@/features/profile/profile-page').then((m) => ({ default: m.ProfilePage }))
);
const InsightsPage = lazyWithRetry(() =>
  import('@/features/insights/insights-page').then((m) => ({ default: m.InsightsPage }))
);
const ExerciseWikiIndexPageEs = lazyWithRetry(() =>
  import('@/features/exercise-wiki/exercise-wiki-index-page').then((m) => ({
    default: () => m.ExerciseWikiIndexPage({ lang: 'es' }),
  }))
);
const ExerciseWikiIndexPageEn = lazyWithRetry(() =>
  import('@/features/exercise-wiki/exercise-wiki-index-page').then((m) => ({
    default: () => m.ExerciseWikiIndexPage({ lang: 'en' }),
  }))
);
const ExerciseArticlePageEs = lazyWithRetry(() =>
  import('@/features/exercise-wiki/exercise-article-page').then((m) => ({
    default: () => m.ExerciseArticlePage({ lang: 'es' }),
  }))
);
const ExerciseArticlePageEn = lazyWithRetry(() =>
  import('@/features/exercise-wiki/exercise-article-page').then((m) => ({
    default: () => m.ExerciseArticlePage({ lang: 'en' }),
  }))
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

const ejerciciosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ejercicios',
  pendingComponent: ContentPageSkeleton,
  component: ExerciseWikiIndexPageEs,
});

const ejerciciosArticleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ejercicios/$slug',
  pendingComponent: ContentPageSkeleton,
  component: ExerciseArticlePageEs,
});

const exercisesEnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/exercises',
  pendingComponent: ContentPageSkeleton,
  component: ExerciseWikiIndexPageEn,
});

const exercisesEnArticleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/exercises/$slug',
  pendingComponent: ContentPageSkeleton,
  component: ExerciseArticlePageEn,
});

// TanStack Router v1 reads not-found from `defaultNotFoundComponent` on the
// router (or `notFoundComponent` on a route) — `path: '*'` is not a real
// wildcard match. We keep a route registered so the prerender script can hit
// `/__not_found__` and snapshot the rendered output for `dist/404.html`.
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '__not_found__',
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

const dashboardRedirectRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/dashboard',
  beforeLoad: () => {
    throw redirect({ to: '/app/profile', replace: true });
  },
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

const insightsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/app/insights',
  pendingComponent: DashboardSkeleton,
  component: InsightsPage,
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
  ejerciciosRoute,
  ejerciciosArticleRoute,
  exercisesEnRoute,
  exercisesEnArticleRoute,
  notFoundRoute,
  appLayoutRoute.addChildren([
    appIndexRoute,
    dashboardRedirectRoute,
    programsRoute,
    trackerIndexRoute,
    trackerProgramRoute,
    insightsRoute,
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
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
  defaultNotFoundComponent: NotFound,
});

// ---------------------------------------------------------------------------
// TypeScript registration
// ---------------------------------------------------------------------------

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
