/**
 * GuestBanner tests — REQ-GUI-002 scenarios.
 * Verifies banner rendering, CTA behavior, and absence for non-guests.
 */
import { describe, it, expect, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { createElement, useEffect, useRef } from 'react';
import type { FC, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mock API layer (required by any provider that touches auth)
// ---------------------------------------------------------------------------

mock.module('@/lib/api', () => ({
  refreshAccessToken: mock(() => Promise.resolve(null)),
  setAccessToken: mock(() => {}),
  getAccessToken: mock(() => null),
}));

mock.module('@/lib/api-functions', () => ({
  apiFetch: mock(() => Promise.reject(new Error('no auth'))),
  fetchCatalogList: mock(() => Promise.resolve([])),
  fetchCatalogDetail: mock(() => Promise.resolve(null)),
  fetchPrograms: mock(() => Promise.resolve([])),
  fetchGenericProgramDetail: mock(() => Promise.resolve(null)),
  deleteProgram: mock(() => Promise.resolve()),
}));

// Mock router navigation — tests don't exercise navigation
mock.module('@tanstack/react-router', () => ({
  useNavigate: () => mock(() => Promise.resolve()),
  Link: ({ children, ...rest }: { readonly children: ReactNode; readonly [k: string]: unknown }) =>
    createElement('a', rest, children),
}));

// Real providers
import { GuestProvider, useGuest } from '@/contexts/guest-context';
import { GuestBanner } from './guest-banner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrapper that enters guest mode once on mount. */
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

function createGuestWrapper(): FC<{ readonly children: ReactNode }> {
  return function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
    return createElement(GuestProvider, null, createElement(GuestActivator, null, children));
  };
}

// ---------------------------------------------------------------------------
// Tests — REQ-GUI-002
// ---------------------------------------------------------------------------

describe('GuestBanner', () => {
  describe('REQ-GUI-002: banner renders with correct content', () => {
    it('should display "Modo invitado" text', () => {
      const Wrapper = createGuestWrapper();
      render(createElement(Wrapper, null, createElement(GuestBanner)));

      expect(screen.getByText(/Modo invitado/)).toBeDefined();
    });

    it('should have role="status" for accessibility', () => {
      const Wrapper = createGuestWrapper();
      render(createElement(Wrapper, null, createElement(GuestBanner)));

      expect(screen.getByRole('status')).toBeDefined();
    });

    it('should display a "Crear Cuenta" CTA button', () => {
      const Wrapper = createGuestWrapper();
      render(createElement(Wrapper, null, createElement(GuestBanner)));

      const button = screen.getByRole('button', { name: /Crear cuenta/i });
      expect(button).toBeDefined();
    });

    it('should apply the provided className', () => {
      const Wrapper = createGuestWrapper();
      render(createElement(Wrapper, null, createElement(GuestBanner, { className: 'mb-6' })));

      const banner = screen.getByRole('status');
      expect(banner.className).toContain('mb-6');
    });
  });

  describe('REQ-GUI-002: CTA behaviour', () => {
    it('should render a button with type="button"', () => {
      const Wrapper = createGuestWrapper();
      render(createElement(Wrapper, null, createElement(GuestBanner)));

      const button = screen.getByRole('button', { name: /Crear cuenta/i });
      expect(button.getAttribute('type')).toBe('button');
    });

    it('should have an accessible aria-label on the CTA', () => {
      const Wrapper = createGuestWrapper();
      render(createElement(Wrapper, null, createElement(GuestBanner)));

      const button = screen.getByLabelText(/Crear cuenta para guardar tu progreso/i);
      expect(button).toBeDefined();
    });
  });
});
