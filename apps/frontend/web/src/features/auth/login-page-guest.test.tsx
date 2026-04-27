/**
 * LoginPage guest-mode tests — REQ-GUI-001 and REQ-GUI-007 scenarios.
 * Verifies "Probar sin cuenta" button presence, guest entry flow, and visual hierarchy.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
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
// Mock API layer (required by AuthProvider bootstrap)
// ---------------------------------------------------------------------------

const mockRefreshAccessToken = mock<() => Promise<string | null>>(() => Promise.resolve(null));

mock.module('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: mock(() => {}),
  getAccessToken: mock(() => null),
}));

mock.module('@/lib/api-functions', () => ({
  apiFetch: mock(() => Promise.reject(new Error('no auth'))),
  fetchMe: mock(() => Promise.resolve(null)),
  parseUserSafe: mock(() => null),
  fetchCatalogList: mock(() => Promise.resolve([])),
  fetchCatalogDetail: mock(() => Promise.resolve(null)),
  fetchPrograms: mock(() => Promise.resolve([])),
  fetchGenericProgramDetail: mock(() => Promise.resolve(null)),
  deleteProgram: mock(() => Promise.resolve()),
}));

// Mock @react-oauth/google — third-party, no own tests in this project
mock.module('@react-oauth/google', () => ({
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
  mockRefreshAccessToken.mockClear();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));
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
      // The auth card has the text "Autenticar"
      const authLabel = screen.getByText('Autenticar');
      // Walk up to the styled card container
      const authCard = authLabel.closest('div[style]');

      expect(authCard?.contains(guestButton)).toBe(false);
    });
  });
});
