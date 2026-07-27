import type { Href } from 'expo-router';

export const AUTH_ROUTES = {
  login: '/login',
  signup: '/signup',
  verifyEmail: '/verify-email',
} as const satisfies Record<string, Href>;

export const PRIMARY_TAB_ROUTES = {
  programs: '/programs',
  tracker: '/tracker',
  profile: '/profile',
} as const satisfies Record<string, Href>;

export type PrimaryTab = keyof typeof PRIMARY_TAB_ROUTES;

export type NavigationAuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticated' };

export function resolveInitialRoute(state: NavigationAuthState): Href | null {
  switch (state.status) {
    case 'loading':
      return null;
    case 'anonymous':
      return AUTH_ROUTES.login;
    case 'authenticated':
      return PRIMARY_TAB_ROUTES.tracker;
  }
}

export function createProgramRoute(programInstanceId: string) {
  return {
    pathname: '/program/[instanceId]',
    params: { instanceId: programInstanceId },
  } as const satisfies Href;
}

export function parseProgramInstanceId(
  value: string | readonly string[] | undefined
): string | null {
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
