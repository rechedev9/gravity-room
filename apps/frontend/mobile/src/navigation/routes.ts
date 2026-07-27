import type { PublicRoutePath, RouteFileId } from './route-manifest.generated';

export const AUTH_ROUTES = {
  login: '/login',
  signup: '/signup',
  verifyEmail: '/verify-email',
} as const satisfies Record<string, PublicRoutePath>;

export const PRIMARY_TAB_ROUTES = {
  programs: '/programs',
  tracker: '/tracker',
  profile: '/profile',
} as const satisfies Record<string, PublicRoutePath>;

export const PROTECTED_SECONDARY_ROUTE_FILE_IDS = [
  'program/[instanceId]',
  'program/new',
  'program/editor/[definitionId]',
  'workout/history',
  'workout/[sessionId]',
  'exercise/index',
  'exercise/[exerciseId]',
  'sync',
] as const satisfies readonly RouteFileId[];

export type PrimaryTab = keyof typeof PRIMARY_TAB_ROUTES;

export type NavigationAuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated' };

export interface InitialRouteContext {
  readonly hasActiveWorkout: boolean;
  readonly lastPrimaryTab: PrimaryTab | null;
}

const EMPTY_INITIAL_ROUTE_CONTEXT: InitialRouteContext = {
  hasActiveWorkout: false,
  lastPrimaryTab: null,
};

export interface ActiveWorkoutLookup {
  readonly hasInProgressWorkout: () => Promise<boolean>;
}

/**
 * M3 owns the workout_sessions repository and will replace this adapter.
 * Keeping the boundary here makes M1's ordering executable without activating
 * the v2 schema or claiming that an in-progress-session query already exists.
 */
export const deferredActiveWorkoutLookup: ActiveWorkoutLookup = {
  hasInProgressWorkout: async () => false,
};

export interface InitialRouteContextDependencies {
  readonly activeWorkoutLookup: ActiveWorkoutLookup;
  readonly readLastPrimaryTab: () => Promise<PrimaryTab | null>;
}

export async function loadInitialRouteContext(
  dependencies: InitialRouteContextDependencies
): Promise<InitialRouteContext> {
  const [hasActiveWorkout, lastPrimaryTab] = await Promise.all([
    dependencies.activeWorkoutLookup.hasInProgressWorkout().catch(() => false),
    dependencies.readLastPrimaryTab().catch(() => null),
  ]);

  return { hasActiveWorkout, lastPrimaryTab };
}

export function resolveInitialRoute(
  state: NavigationAuthState,
  context: InitialRouteContext = EMPTY_INITIAL_ROUTE_CONTEXT
): string | null {
  switch (state.status) {
    case 'loading':
      return null;
    case 'anonymous':
      return AUTH_ROUTES.login;
    case 'authenticated':
      if (context.hasActiveWorkout) {
        return PRIMARY_TAB_ROUTES.tracker;
      }
      return context.lastPrimaryTab
        ? PRIMARY_TAB_ROUTES[context.lastPrimaryTab]
        : PRIMARY_TAB_ROUTES.programs;
  }
}

export function createProgramRoute(programInstanceId: string) {
  const pathname = '/program/[instanceId]' satisfies PublicRoutePath;
  return {
    pathname,
    params: { instanceId: programInstanceId },
  } as const;
}

export function parseRouteIdentifier(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return null;
  }

  return value;
}

export function parseProgramInstanceId(value: unknown): string | null {
  return parseRouteIdentifier(value);
}

export interface SafeBackRouter {
  readonly back: () => void;
  readonly canGoBack: () => boolean;
  readonly replace: (href: string) => void;
}

export function returnFromProgramRoute(router: SafeBackRouter): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(PRIMARY_TAB_ROUTES.programs);
}
