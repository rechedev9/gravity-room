import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';

// Mock the router's Link — same pattern as exercise-wiki-index-page.test.tsx.
// mock.module is process-global in Bun, so we stub Link here to be
// order-independent and avoid needing a real RouterProvider.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: {
    readonly children: ReactNode;
    readonly [k: string]: unknown;
  }) => {
    const anchorProps = { ...props };
    delete anchorProps.to;
    delete anchorProps.params;
    return createElement('a', anchorProps, children);
  },
}));

import { ArticleNotFound } from './article-not-found';

describe('ArticleNotFound', () => {
  it('sets noindex robots meta for es', () => {
    render(<ArticleNotFound lang="es" />);
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    expect(robots?.content).toContain('noindex');
  });
});
