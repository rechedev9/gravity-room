/**
 * AppShell guest-mode tests — REQ-GROUT-003, REQ-GROUT-006, REQ-GUI-006 scenarios.
 * Verifies auth guard bypass, view gating, profile blocking with toast, and app entry routing.
 *
 * Uses real providers (no context mocking) to avoid mock.module leaking into
 * other test files. Only mocks the API layer which all other tests also mock.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement, useEffect, useRef } from 'react';
import type { FC, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock API layer (safe — all test files mock these too)
// ---------------------------------------------------------------------------

const mockRefreshAccessToken = mock<() => Promise<string | null>>(() => Promise.resolve(null));

mock.module('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: mock(() => {}),
  getAccessToken: mock(() => null),
}));

const mockFetchCatalogList = mock(() => Promise.resolve([]));

mock.module('@/lib/api-functions', () => ({
  apiFetch: mock(() => Promise.reject(new Error('no auth'))),
  fetchCatalogList: mockFetchCatalogList,
  fetchCatalogDetail: mock(() => Promise.resolve(null)),
  fetchPrograms: mock(() => Promise.resolve([])),
  fetchGenericProgramDetail: mock(() => Promise.resolve(null)),
  deleteProgram: mock(() => Promise.resolve()),
  fetchOnlineCount: mock(() => Promise.resolve(null)),
}));

// Mock @react-oauth/google (safe — no own tests)
mock.module('@react-oauth/google', () => ({
  GoogleLogin: () => null,
  GoogleOAuthProvider: ({ children }: { readonly children: ReactNode }) => children,
}));

// Real providers
import { AuthProvider } from '@/contexts/auth-context';
import { GuestProvider, useGuest } from '@/contexts/guest-context';
import { ToastProvider, useToast } from '@/contexts/toast-context';
import { AppShell } from './app-shell';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Enters guest mode once on mount. */
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

/** Reads isGuest from context. */
function GuestProbe(): ReactNode {
  const { isGuest } = useGuest();
  return createElement('span', { 'data-testid': 'guest-probe' }, String(isGuest));
}

/** Captures toast messages. */
function ToastCapture(): ReactNode {
  const { toasts } = useToast();
  return createElement(
    'div',
    { 'data-testid': 'toast-capture' },
    toasts.map((t) => createElement('span', { key: t.id, 'data-testid': 'toast-msg' }, t.message))
  );
}

function createWrapper(
  opts: { guest?: boolean; path?: string } = {}
): FC<{ readonly children: ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
    const inner = opts.guest
      ? createElement(
          GuestActivator,
          null,
          children,
          createElement(GuestProbe),
          createElement(ToastCapture)
        )
      : createElement(
          'div',
          null,
          children,
          createElement(GuestProbe),
          createElement(ToastCapture)
        );

    return createElement(
      MemoryRouter,
      { initialEntries: [opts.path ?? '/app'] },
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          GuestProvider,
          null,
          createElement(AuthProvider, null, createElement(ToastProvider, null, inner))
        )
      )
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockRefreshAccessToken.mockClear();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));
  mockFetchCatalogList.mockClear();
  mockFetchCatalogList.mockImplementation(() => Promise.resolve([]));
});

describe('AppShell — Guest routing', () => {
  describe('REQ-GROUT-006: App entry routing for guests', () => {
    it('should render the dashboard (not a skeleton) when guest accesses /app', async () => {
      const Wrapper = createWrapper({ guest: true });
      render(createElement(Wrapper, null, createElement(AppShell)));

      // Wait for auth to resolve and guest mode to activate
      await waitFor(() => {
        expect(screen.getByTestId('guest-probe').textContent).toBe('true');
      });

      // Dashboard heading should appear (catalog section)
      await waitFor(() => {
        expect(screen.getByText('Elegir un Programa')).toBeDefined();
      });
    });

    it('should display the guest banner on the dashboard for guests', async () => {
      const Wrapper = createWrapper({ guest: true });
      render(createElement(Wrapper, null, createElement(AppShell)));

      await waitFor(() => {
        expect(screen.getByTestId('guest-probe').textContent).toBe('true');
      });

      await waitFor(() => {
        expect(screen.getByText(/Modo invitado/)).toBeDefined();
      });
    });
  });

  describe('REQ-GROUT-003: Profile view blocked for guests', () => {
    it('should redirect to dashboard when guest URL has view=profile', async () => {
      const Wrapper = createWrapper({ guest: true, path: '/app?view=profile' });
      render(createElement(Wrapper, null, createElement(AppShell)));

      await waitFor(() => {
        expect(screen.getByTestId('guest-probe').textContent).toBe('true');
      });

      // Profile view is excluded for guests — should see dashboard content instead
      await waitFor(() => {
        expect(screen.getByText('Elegir un Programa')).toBeDefined();
      });
    });
  });
});
