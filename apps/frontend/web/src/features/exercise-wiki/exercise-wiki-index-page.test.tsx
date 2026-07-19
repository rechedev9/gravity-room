import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EXERCISE_ARTICLES } from './content/registry';

// The in-app variant embeds the exercise catalog browser, which uses TanStack
// Query. Wrap those renders in a QueryClient (retry disabled so the network
// query's happy-dom fetch failure settles immediately instead of scheduling
// retry timers that would outlive the test).
function renderInApp(ui: ReactNode): ReturnType<typeof render> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// Mock the router's Link only. Rendering the page through a real
// RouterProvider is not viable here: `mock.module` is process-global in Bun,
// and several other test files replace `@tanstack/react-router` with a Link
// stub for the whole run — a real RouterProvider would be clobbered depending
// on file order. Mocking Link ourselves makes this test order-independent and
// matches the convention used across the suite (see guest-banner.test.tsx).
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: {
    readonly children: ReactNode;
    readonly [k: string]: unknown;
  }) => {
    // Drop router-only props so they aren't forwarded as DOM attributes.
    const anchorProps = { ...props };
    delete anchorProps.to;
    delete anchorProps.params;
    return createElement('a', anchorProps, children);
  },
}));

// The page reads auth/guest to decide whether to show the back-to-app affordance.
// Stub both as logged-out so the test renders the public view in isolation
// (no AuthProvider/GuestProvider needed), matching the Link-mocking convention above.
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('@/contexts/guest-context', () => ({
  useGuest: () => ({ isGuest: false }),
}));

// The in-app catalog browser fetches from the API on mount. Stub the data layer
// so the test never issues a real network request (which happy-dom would abort
// on teardown, logging noise) and settles into a deterministic empty catalog.
vi.mock('@/lib/api-functions', () => ({
  fetchExercises: vi.fn().mockResolvedValue({ data: [], total: 0, offset: 0, limit: 20 }),
  fetchMuscleGroups: vi.fn().mockResolvedValue([]),
}));

import { ExerciseWikiIndexPage } from './exercise-wiki-index-page';

describe('ExerciseWikiIndexPage', () => {
  it('renders a link per curated article', () => {
    render(<ExerciseWikiIndexPage lang="es" />);
    const links = screen.getAllByTestId('exercise-card');
    expect(links).toHaveLength(EXERCISE_ARTICLES.length);
  });

  it('renders the in-app variant with a link per article and no public back-to-app affordance', () => {
    renderInApp(<ExerciseWikiIndexPage lang="es" inApp />);
    expect(screen.getAllByTestId('exercise-card')).toHaveLength(EXERCISE_ARTICLES.length);
    // In-app the sidebar provides navigation, so the marketing "back to app"
    // link is dropped.
    expect(screen.queryByText('Volver a la app')).not.toBeInTheDocument();
  });

  it('adds hreflang alternates to <head>', () => {
    render(<ExerciseWikiIndexPage lang="es" />);
    const esLink = document.head.querySelector('link[rel="alternate"][hreflang="es"]');
    const enLink = document.head.querySelector('link[rel="alternate"][hreflang="en"]');
    const defaultLink = document.head.querySelector('link[rel="alternate"][hreflang="x-default"]');
    expect(esLink?.getAttribute('href')).toBe('https://gravityroom.app/ejercicios');
    expect(enLink?.getAttribute('href')).toBe('https://gravityroom.app/en/exercises');
    expect(defaultLink?.getAttribute('href')).toBe('https://gravityroom.app/en/exercises');
  });
});
