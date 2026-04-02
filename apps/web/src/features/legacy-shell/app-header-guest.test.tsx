/**
 * AppHeader guest-mode tests — REQ-GUI-003, REQ-GUI-008 scenarios.
 * Verifies three-state header rendering and guest CTA behavior.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement, useEffect, useRef } from 'react';
import type { FC, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock API layer — control whether auth bootstraps a user
// ---------------------------------------------------------------------------

const mockRefreshAccessToken = mock<() => Promise<string | null>>(() => Promise.resolve(null));
const mockApiFetch = mock<(path: string) => Promise<unknown>>(() =>
  Promise.reject(new Error('no auth'))
);

mock.module('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: mock(() => {}),
  getAccessToken: mock(() => null),
}));

mock.module('@/lib/api-functions', () => ({
  apiFetch: mockApiFetch,
  fetchCatalogList: mock(() => Promise.resolve([])),
  fetchCatalogDetail: mock(() => Promise.resolve(null)),
  fetchPrograms: mock(() => Promise.resolve([])),
  fetchGenericProgramDetail: mock(() => Promise.resolve(null)),
  deleteProgram: mock(() => Promise.resolve()),
}));

// Real providers
import { AuthProvider } from '@/contexts/auth-context';
import { GuestProvider, useGuest } from '@/contexts/guest-context';
import { AppHeader } from './app-header';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Helper: creates a valid JWT payload (base64url encoded). */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

/** Enters guest mode once on mount (not on every re-render). */
function GuestActivator({ children }: { readonly children: ReactNode }): ReactNode {
  const { enterGuestMode } = useGuest();
  const entered = useRef(false);
  useEffect(() => {
    if (!entered.current) {
      entered.current = true;
      enterGuestMode();
    }
  }, []);
  return createElement('div', null, children);
}

/** Reads isGuest to verify state changes. */
function GuestProbe(): ReactNode {
  const { isGuest } = useGuest();
  return createElement('span', { 'data-testid': 'guest-probe' }, String(isGuest));
}

/** Creates a wrapper with real providers; optionally activates guest mode. */
function createWrapper(opts: { guest?: boolean } = {}): FC<{ readonly children: ReactNode }> {
  return function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
    const inner = opts.guest
      ? createElement(GuestActivator, null, children, createElement(GuestProbe))
      : createElement('div', null, children, createElement(GuestProbe));

    return createElement(
      MemoryRouter,
      null,
      createElement(GuestProvider, null, createElement(AuthProvider, null, inner))
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRefreshAccessToken.mockClear();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));
  mockApiFetch.mockClear();
  mockApiFetch.mockImplementation(() => Promise.reject(new Error('no auth')));
});

describe('AppHeader — Guest mode', () => {
  describe('REQ-GUI-008: Three-state header rendering', () => {
    it('should show "Crear Cuenta" button when isGuest is true', async () => {
      const Wrapper = createWrapper({ guest: true });
      render(createElement(Wrapper, null, createElement(AppHeader)));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Crear cuenta/i })).toBeDefined();
      });
    });

    it('should NOT show "Crear Cuenta" when user is authenticated and not guest', async () => {
      // Simulate authenticated user
      const token = fakeJwt({ sub: 'u1', email: 'test@test.com' });
      mockRefreshAccessToken.mockImplementation(() => Promise.resolve(token));
      mockApiFetch.mockImplementation((path: string) => {
        if (path === '/auth/me')
          return Promise.resolve({ id: 'u1', email: 'test@test.com', name: null });
        return Promise.reject(new Error('Unauthorized'));
      });

      const Wrapper = createWrapper({ guest: false });
      render(createElement(Wrapper, null, createElement(AppHeader)));

      // Wait for auth to resolve
      await waitFor(() => {
        expect(screen.getByLabelText('Menú de usuario')).toBeDefined();
      });

      const button = screen.queryByRole('button', { name: /Crear cuenta/i });
      expect(button).toBeNull();
    });

    it('should show "Iniciar Sesión" link when not guest and no user', async () => {
      const Wrapper = createWrapper({ guest: false });
      render(createElement(Wrapper, null, createElement(AppHeader)));

      await waitFor(() => {
        expect(screen.getByText('Iniciar Sesión')).toBeDefined();
      });

      const link = screen.getByText('Iniciar Sesión');
      expect(link.getAttribute('href')).toBe('/login');
    });

    it('should show the avatar button when user is authenticated and not guest', async () => {
      const token = fakeJwt({ sub: 'u1', email: 'test@test.com' });
      mockRefreshAccessToken.mockImplementation(() => Promise.resolve(token));
      mockApiFetch.mockImplementation((path: string) => {
        if (path === '/auth/me')
          return Promise.resolve({ id: 'u1', email: 'test@test.com', name: null });
        return Promise.reject(new Error('Unauthorized'));
      });

      const Wrapper = createWrapper({ guest: false });
      render(createElement(Wrapper, null, createElement(AppHeader)));

      await waitFor(() => {
        expect(screen.getByLabelText('Menú de usuario')).toBeDefined();
      });
    });

    it('should NOT show avatar dropdown when isGuest is true', async () => {
      const Wrapper = createWrapper({ guest: true });
      render(createElement(Wrapper, null, createElement(AppHeader)));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Crear cuenta/i })).toBeDefined();
      });

      const avatarButton = screen.queryByLabelText('Menú de usuario');
      expect(avatarButton).toBeNull();
    });
  });

  describe('REQ-GUI-003: Clicking "Crear Cuenta" exits guest mode', () => {
    it('should exit guest mode when "Crear Cuenta" is clicked', async () => {
      const Wrapper = createWrapper({ guest: true });
      render(createElement(Wrapper, null, createElement(AppHeader)));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Crear cuenta/i })).toBeDefined();
      });

      // Verify we start in guest mode
      expect(screen.getByTestId('guest-probe').textContent).toBe('true');

      fireEvent.click(screen.getByRole('button', { name: /Crear cuenta/i }));

      // Verify isGuest changed to false
      await waitFor(() => {
        expect(screen.getByTestId('guest-probe').textContent).toBe('false');
      });
    });
  });
});
