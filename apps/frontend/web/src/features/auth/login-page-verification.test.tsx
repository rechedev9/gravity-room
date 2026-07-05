/**
 * LoginPage - resend-verification affordance. When an email/password sign-in
 * fails with EMAIL_NOT_VERIFIED, the page must surface the "check your inbox"
 * message plus a "Resend verification email" button that calls the new
 * /auth/resend-verification endpoint, with success feedback and basic
 * client-side throttling (disabled after a successful send).
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
import { ApiError } from '@gzclp/api-client/api-error';

const { mockRefreshAccessToken, mockFetchAuthProviders, mockApiFetch } = vi.hoisted(() => ({
  mockRefreshAccessToken: vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
  mockFetchAuthProviders: vi.fn(() =>
    Promise.resolve({
      emailPassword: true,
      google: false,
      apple: false,
      github: false,
      microsoft: false,
    })
  ),
  mockApiFetch: vi.fn<(path: string, options?: unknown) => Promise<unknown>>(() =>
    Promise.reject(new Error('not configured'))
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
    apiFetch: mockApiFetch,
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

/** Expands the progressive-disclosure email form and submits sign-in credentials. */
async function submitSignIn(): Promise<void> {
  const toggle = await screen.findByRole('button', { name: /Continuar con email/i });
  fireEvent.click(toggle);
  fireEvent.change(await screen.findByPlaceholderText('tu@ejemplo.com'), {
    target: { value: 'unverified@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Tu contraseña'), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^Entrar$/i }));
}

beforeEach(() => {
  mockRefreshAccessToken.mockClear();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));
  mockFetchAuthProviders.mockClear();
  mockApiFetch.mockReset();
});

describe('LoginPage - resend verification affordance', () => {
  it('shows the resend button after an EMAIL_NOT_VERIFIED sign-in and sends on click', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/auth/login') {
        return Promise.reject(new ApiError('Email not verified', 403, 'EMAIL_NOT_VERIFIED'));
      }
      if (path === '/auth/resend-verification') {
        return Promise.resolve(null);
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    render(createElement(createWrapper(), null, createElement(LoginPage)));
    await submitSignIn();

    // The "check your inbox" message renders...
    await waitFor(() => {
      expect(screen.getByText(/Verifica tu correo antes de entrar/i)).toBeDefined();
    });
    // ...alongside the resend affordance.
    const resendButton = await screen.findByRole('button', {
      name: /Reenviar correo de verificación/i,
    });

    fireEvent.click(resendButton);

    // Success feedback appears and the button is disabled (client-side throttle).
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
    });
    expect((resendButton as HTMLButtonElement).disabled).toBe(true);
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/auth/resend-verification',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('surfaces an error and keeps the button enabled when the resend call fails', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/auth/login') {
        return Promise.reject(new ApiError('Email not verified', 403, 'EMAIL_NOT_VERIFIED'));
      }
      if (path === '/auth/resend-verification') {
        return Promise.reject(new ApiError('Too many requests', 429, 'RATE_LIMITED'));
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    render(createElement(createWrapper(), null, createElement(LoginPage)));
    await submitSignIn();

    const resendButton = await screen.findByRole('button', {
      name: /Reenviar correo de verificación/i,
    });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(screen.getByText(/No se pudo reenviar el correo/i)).toBeDefined();
    });
    // Failure leaves the button clickable so the user can retry.
    expect((resendButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not show the resend button for ordinary invalid-credential failures', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === '/auth/login') {
        return Promise.reject(new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS'));
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    render(createElement(createWrapper(), null, createElement(LoginPage)));
    await submitSignIn();

    await waitFor(() => {
      expect(screen.getByText(/Correo o contraseña incorrectos/i)).toBeDefined();
    });
    expect(
      screen.queryByRole('button', { name: /Reenviar correo de verificación/i })
    ).toBeNull();
  });
});
