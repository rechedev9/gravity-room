import { describe, expect, it, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { EXERCISE_ARTICLES } from './content/registry';

// Mock the router's Link only. Rendering the page through a real
// RouterProvider is not viable here: `mock.module` is process-global in Bun,
// and several other test files replace `@tanstack/react-router` with a Link
// stub for the whole run — a real RouterProvider would be clobbered depending
// on file order. Mocking Link ourselves makes this test order-independent and
// matches the convention used across the suite (see guest-banner.test.tsx).
mock.module('@tanstack/react-router', () => ({
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
mock.module('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null }),
}));
mock.module('@/contexts/guest-context', () => ({
  useGuest: () => ({ isGuest: false }),
}));

import { ExerciseWikiIndexPage } from './exercise-wiki-index-page';

describe('ExerciseWikiIndexPage', () => {
  it('renders a link per curated article', () => {
    render(<ExerciseWikiIndexPage lang="es" />);
    const links = screen.getAllByTestId('exercise-card');
    expect(links).toHaveLength(EXERCISE_ARTICLES.length);
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
