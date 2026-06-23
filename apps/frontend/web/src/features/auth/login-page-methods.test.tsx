/**
 * LoginPage Mockup B tests — social-first layout + progressive-disclosure email
 * form. Verifies the three provider buttons render and the email form expands
 * with a sign-in/sign-up toggle.
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
import { apiFunctionsStubs } from '../../../test/helpers/api-functions-mock';

const mockRefreshAccessToken = mock<() => Promise<string | null>>(() => Promise.resolve(null));

mock.module('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: mock(() => {}),
  getAccessToken: mock(() => null),
}));

mock.module('@/lib/api-functions', () => ({
  ...apiFunctionsStubs,
  apiFetch: mock(() => Promise.reject(new Error('no auth'))),
}));

mock.module('@react-oauth/google', () => ({
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
});

describe('LoginPage — Mockup B (social-first + email)', () => {
  it('renders Google, Apple, and GitHub provider options', async () => {
    render(createElement(createWrapper(), null, createElement(LoginPage)));
    await waitFor(() => {
      expect(screen.getByTestId('google-login')).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /Continuar con Apple/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Continuar con GitHub/i })).toBeDefined();
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
