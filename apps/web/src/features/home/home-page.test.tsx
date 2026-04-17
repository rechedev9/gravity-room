/**
 * Home page render smoke tests.
 * Verifies that HomeEmptyState variant="guest" renders locale-appropriate copy.
 * Spec: REQ — Home strings resolve through i18n for all supported locales (guest empty-state).
 */
import { describe, it, expect, afterEach, mock } from 'bun:test';
import i18n from 'i18next';
import { createElement } from 'react';

// ---------------------------------------------------------------------------
// Mocks BEFORE imports (Bun requirement)
// ---------------------------------------------------------------------------

mock.module('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
}));

mock.module('@tanstack/react-router', () => ({
  useNavigate: () => mock(() => Promise.resolve()),
  Link: ({
    children,
    ...rest
  }: {
    readonly children: React.ReactNode;
    readonly [k: string]: unknown;
  }) => createElement('a', rest as Record<string, unknown>, children),
}));

mock.module('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null, configured: true }),
}));

mock.module('@/contexts/guest-context', () => ({
  useGuest: () => ({
    isGuest: true,
    enterGuestMode: mock(() => {}),
    exitGuestMode: mock(() => {}),
  }),
}));

mock.module('@/lib/api-functions', () => ({
  fetchPrograms: mock(() => Promise.resolve([])),
  fetchInsights: mock(() => Promise.resolve([])),
}));

mock.module('@/lib/query-keys', () => ({
  queryKeys: {
    programs: { all: ['programs'] },
    insights: { list: (types: string[]) => ['insights', types] },
  },
}));

mock.module('@/lib/insight-payloads', () => ({
  isFrequencyPayload: () => false,
}));

mock.module('@/components/guest-banner', () => ({
  GuestBanner: ({ className }: { readonly className?: string }) =>
    createElement('div', { 'data-testid': 'guest-banner', className }),
}));

mock.module('@/features/dashboard/active-program-card', () => ({
  ActiveProgramCard: () => createElement('div', { 'data-testid': 'active-program-card' }),
}));

mock.module('@/lib/motion-primitives', () => ({
  StaggerContainer: ({
    children,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly className?: string;
  }) => createElement('div', { className }, children),
  StaggerItem: ({
    children,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly className?: string;
  }) => createElement('div', { className }, children),
  fadeUpFastVariants: {},
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { HomePage } from './home-page';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomePage i18n', () => {
  afterEach(async () => {
    await i18n.changeLanguage('es');
  });

  it('renders guest empty-state in Spanish (default)', () => {
    render(createElement(HomePage));
    expect(screen.getByText('Modo invitado')).toBeInTheDocument();
  });

  it('renders guest empty-state in English after language change', async () => {
    await i18n.changeLanguage('en');
    render(createElement(HomePage));
    expect(screen.getByText('Guest mode')).toBeInTheDocument();
  });
});
