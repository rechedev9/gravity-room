/**
 * LoginPage guest-mode tests — REQ-GUI-001 and REQ-GUI-007 scenarios.
 * Verifies "Probar sin cuenta" button presence, guest entry flow, and visual hierarchy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { FC, ReactNode } from 'react';
import {
  createRouter,
  createRootRoute,
  createRoute,
  RouterProvider,
  createMemoryHistory,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock API layer (required by AuthProvider bootstrap). vi.mock is hoisted above
// imports, so the fns the factories/beforeEach reference are created via
// vi.hoisted and the shared stubs are pulled in with a dynamic import.
// ---------------------------------------------------------------------------

const { mockRefreshAccessToken, mockFetchAuthProviders } = vi.hoisted(() => ({
  mockRefreshAccessToken: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
  mockFetchAuthProviders: vi.fn(() =>
    Promise.resolve({
      emailPassword: true,
      google: true,
      apple: false,
      github: false,
      microsoft: false,
    })
  ),
}));

vi.mock('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: vi.fn(() => {}),
  getAccessToken: vi.fn(() => null),
}));

vi.mock('@/lib/api-functions', async () => {
  const { apiFunctionsStubs } = await import('../../../test/helpers/api-functions-mock');
  return {
    ...apiFunctionsStubs,
    apiFetch: vi.fn(() => Promise.reject(new Error('no auth'))),
    fetchAuthProviders: mockFetchAuthProviders,
  };
});

// Mock @react-oauth/google — third-party, no own tests in this project
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => createElement('div', { 'data-testid': 'google-login' }, 'Google Sign-In'),
  GoogleOAuthProvider: ({ children }: { readonly children: ReactNode }) => children,
}));

// Real providers
import { AuthProvider } from '@/contexts/auth-context';
import { GuestProvider, useGuest } from '@/contexts/guest-context';
import { LoginPage } from './login-page';

// ---------------------------------------------------------------------------
// Test router factory
// ---------------------------------------------------------------------------

function createTestRouter(component: ReactNode): ReturnType<typeof createRouter> {
  const rootRoute = createRootRoute({
    component: () => component,
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => component,
  });
  const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/app',
    component: () => createElement('div', null, 'App'),
  });
  const routeTree = rootRoute.addChildren([loginRoute, appRoute]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/login'] }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads isGuest from the real GuestContext to verify state changes. */
function GuestStateProbe(): ReactNode {
  const { isGuest } = useGuest();
  return createElement('span', { 'data-testid': 'guest-probe' }, String(isGuest));
}

function createWrapper(): FC<{ readonly children: ReactNode }> {
  return function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const testRouter = createTestRouter(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          GuestProvider,
          null,
          createElement(AuthProvider, null, children, createElement(GuestStateProbe))
        )
      )
    );
    return createElement(RouterProvider, { router: testRouter });
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-web-client-id');
  mockRefreshAccessToken.mockClear();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));
  mockFetchAuthProviders.mockClear();
  mockFetchAuthProviders.mockImplementation(() =>
    Promise.resolve({
      emailPassword: true,
      google: true,
      apple: false,
      github: false,
      microsoft: false,
    })
  );
});

describe('LoginPage — Guest entry', () => {
  describe('REQ-GUI-001: Guest entry button on login page', () => {
    it('should render a "Probar sin cuenta" button', async () => {
      const Wrapper = createWrapper();
      render(createElement(Wrapper, null, createElement(LoginPage)));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Probar sin cuenta/i })).toBeDefined();
      });
    });

    it('should have type="button" on the guest entry button', async () => {
      const Wrapper = createWrapper();
      render(createElement(Wrapper, null, createElement(LoginPage)));

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Probar sin cuenta/i });
        expect(button.getAttribute('type')).toBe('button');
      });
    });

    it('should enter guest mode when clicked', async () => {
      const Wrapper = createWrapper();
      render(createElement(Wrapper, null, createElement(LoginPage)));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Probar sin cuenta/i })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /Probar sin cuenta/i }));

      // Verify isGuest changed via the probe
      await waitFor(() => {
        expect(screen.getByTestId('guest-probe').textContent).toBe('true');
      });
    });
  });

  describe('REQ-GUI-007: Visual hierarchy preserved', () => {
    it('should render Google sign-in before the guest entry button in DOM order', async () => {
      const Wrapper = createWrapper();
      render(createElement(Wrapper, null, createElement(LoginPage)));

      await waitFor(() => {
        expect(screen.getByTestId('google-login')).toBeDefined();
      });

      const googleLogin = screen.getByTestId('google-login');
      const guestButton = screen.getByRole('button', { name: /Probar sin cuenta/i });

      // DOCUMENT_POSITION_FOLLOWING means guestButton follows googleLogin
      const comparison = googleLogin.compareDocumentPosition(guestButton);
      const FOLLOWING = 4;
      expect(comparison & FOLLOWING).toBe(FOLLOWING);
    });

    it('should render the guest button outside the auth card', async () => {
      const Wrapper = createWrapper();
      render(createElement(Wrapper, null, createElement(LoginPage)));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Probar sin cuenta/i })).toBeDefined();
      });

      const guestButton = screen.getByRole('button', { name: /Probar sin cuenta/i });
      const authCard = screen.getByTestId('auth-card');

      expect(authCard.contains(guestButton)).toBe(false);
    });
  });
});
