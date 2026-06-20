import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router';
import { ExerciseWikiIndexPage } from './exercise-wiki-index-page';
import { EXERCISE_ARTICLES } from './content/registry';

function renderAt() {
  const root = createRootRoute();
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <ExerciseWikiIndexPage lang="es" />,
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router} />);
}

describe('ExerciseWikiIndexPage', () => {
  it('renders a link per curated article', async () => {
    renderAt();
    const links = await screen.findAllByTestId('exercise-card');
    expect(links).toHaveLength(EXERCISE_ARTICLES.length);
  });
});
