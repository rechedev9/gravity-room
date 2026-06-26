/**
 * LoginPage Mockup B tests — social-first layout + progressive-disclosure email
 * form. Verifies the three provider buttons render and the email form expands
 * with a sign-in/sign-up toggle.
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

// vi.mock is hoisted above imports, so the fns referenced by the factories and
// beforeEach are created via vi.hoisted; the shared stubs come from a dynamic
// import inside the (async) factory.
const { mockRefreshAccessToken, mockFetchAuthProviders } = vi.hoisted(() => ({
  mockRefreshAccessToken: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
  mockFetchAuthProviders: vi.fn(() =>
    Promise.resolve({
      emailPassword: true,
      google: true,
      apple: true,
      github: true,
      microsoft: true,
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

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => createElement('div', { 'data-testid': 'google-login' }, 'Google Sign-In'),
  GoogleOAuthProvider: ({ children }: { readonly children: ReactNode }) => children,
}));

import { AuthProvider } from '@/contexts/auth-context';
import { GuestProvider } from '@/contexts/guest-context';
import { LoginPage } from './login-page';

function createWrapper(): FC<{ readonly children: ReactNode }> {
  return function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const rootRoute = createRootRoute({ component: () => children });
    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/login',
      component: () => children,
    });
    const appRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/app',
      component: () => createElement('div', null, 'App'),
    });
    const testRouter = createRouter({
      routeTree: rootRoute.addChildren([loginRoute, appRoute]),
      history: createMemoryHistory({ initialEntries: ['/login'] }),
    });
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        GuestProvider,
        null,
        createElement(AuthProvider, null, createElement(RouterProvider, { router: testRouter }))
      )
    );
  };
}

beforeEach(() => {
  mockRefreshAccessToken.mockClear();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));
  mockFetchAuthProviders.mockClear();
  mockFetchAuthProviders.mockImplementation(() =>
    Promise.resolve({
      emailPassword: true,
      google: true,
      apple: true,
      github: true,
      microsoft: true,
    })
  );
});

describe('LoginPage — Mockup B (social-first + email)', () => {
  it('renders provider options from /auth/providers including Microsoft Outlook', async () => {
    render(createElement(createWrapper(), null, createElement(LoginPage)));
    await waitFor(() => {
      expect(screen.getByTestId('google-login')).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /Continuar con Apple/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Continuar con GitHub/i })).toBeDefined();
    const microsoftButton = screen.getByRole('button', { name: /Continuar con Outlook/i });
    expect(microsoftButton).toBeDefined();
    expect((microsoftButton as HTMLButtonElement).disabled).toBe(false);
    expect(mockFetchAuthProviders).toHaveBeenCalledTimes(1);
  });

  it('expands the email form on disclosure and toggles to sign-up (name field)', async () => {
    render(createElement(createWrapper(), null, createElement(LoginPage)));

    const toggle = await screen.findByRole('button', { name: /Continuar con email/i });
    fireEvent.click(toggle);

    // Email + password inputs appear.
    const emailInput = await screen.findByPlaceholderText('tu@ejemplo.com');
    expect(emailInput).toBeDefined();
    expect(screen.getByPlaceholderText('Tu contraseña')).toBeDefined();

    // No name field in sign-in mode.
    expect(screen.queryByPlaceholderText('Tu nombre (opcional)')).toBeNull();

    // Switch to sign-up → name field appears.
    fireEvent.click(screen.getByRole('button', { name: /¿No tienes cuenta\? Crear una/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Tu nombre (opcional)')).toBeDefined();
    });
  });
});
