import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuestProvider } from '@/contexts/guest-context';
import { queryKeys } from '@/lib/query-keys';
import { buildFaqJsonLd } from './faq-content';
import { EN_CONTENT, ES_CONTENT } from './content';
import { LandingPageShell } from './landing-page-shell';

vi.mock('@/hooks/use-scroll-spy', () => ({
  useScrollSpy: () => null,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/lib/analytics', () => ({
  getUtmProps: () => ({}),
  trackEvent: vi.fn(),
}));

function renderLandingShell(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.catalog.list(), []);

  const landing = createElement(
    GuestProvider,
    null,
    createElement(LandingPageShell, {
      content: ES_CONTENT,
      head: {},
      lang: 'es',
    })
  );
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => landing,
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: (): ReactNode => createElement('div', null, 'Login'),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, loginRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(RouterProvider, { router })
    )
  );
}

describe('landing content', () => {
  it('keeps the Spanish and English conversion path structurally aligned', () => {
    expect(ES_CONTENT.nav.links).toHaveLength(EN_CONTENT.nav.links.length);
    expect(ES_CONTENT.hero.proofItems).toHaveLength(EN_CONTENT.hero.proofItems.length);
    expect(ES_CONTENT.problem.items).toHaveLength(3);
    expect(EN_CONTENT.problem.items).toHaveLength(3);
    expect(ES_CONTENT.problem.solutionItems).toHaveLength(3);
    expect(EN_CONTENT.problem.solutionItems).toHaveLength(3);
    expect(ES_CONTENT.howItWorks.steps).toHaveLength(3);
    expect(EN_CONTENT.howItWorks.steps).toHaveLength(3);
    expect(ES_CONTENT.features.items).toHaveLength(3);
    expect(EN_CONTENT.features.items).toHaveLength(3);
    expect(ES_CONTENT.freeTrust.items).toHaveLength(4);
    expect(EN_CONTENT.freeTrust.items).toHaveLength(4);
  });

  it('limits the closing FAQ and its structured data to four visible questions', () => {
    expect(ES_CONTENT.faq.items).toHaveLength(4);
    expect(EN_CONTENT.faq.items).toHaveLength(4);
    expect(buildFaqJsonLd(ES_CONTENT.faq.items).mainEntity).toHaveLength(4);
    expect(buildFaqJsonLd(EN_CONTENT.faq.items).mainEntity).toHaveLength(4);
  });

  it('does not retain the removed standalone landing blocks', () => {
    expect('science' in ES_CONTENT).toBe(false);
    expect('midPageCta' in ES_CONTENT).toBe(false);
    expect('comparison' in ES_CONTENT).toBe(false);
    expect('science' in EN_CONTENT).toBe(false);
    expect('midPageCta' in EN_CONTENT).toBe(false);
    expect('comparison' in EN_CONTENT).toBe(false);
  });

  it('renders seven sections with the final CTA inside the FAQ section', async () => {
    const { container } = renderLandingShell();

    await waitFor(() => {
      expect(container.querySelectorAll('main > section')).toHaveLength(7);
    });

    const faqSection = container.querySelector<HTMLElement>('main > section#faq');
    if (faqSection === null) throw new Error('Expected the FAQ section to render');

    expect(
      within(faqSection).getByRole('link', { name: ES_CONTENT.finalCta.cta })
    ).toBeInTheDocument();
  });

  it('reveals and pins the trained hero state for pointer and tap interactions', async () => {
    const { container } = renderLandingShell();

    const control = await waitFor(() =>
      within(container).getByRole('button', {
        name: ES_CONTENT.hero.transformationControlLabel,
      })
    );
    const trainedState = within(container).getByTestId('hero-trained-state');

    expect(control).toHaveAttribute('aria-pressed', 'false');
    expect(trainedState).toHaveClass('opacity-0');

    fireEvent.pointerEnter(control, { pointerType: 'mouse' });
    expect(control).toHaveAttribute('aria-pressed', 'false');
    expect(trainedState).toHaveClass('opacity-100');

    fireEvent.pointerLeave(control, { pointerType: 'mouse' });
    expect(control).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(control);
    expect(control).toHaveAttribute('aria-pressed', 'true');
    expect(trainedState).toHaveClass('opacity-100');
  });
});
