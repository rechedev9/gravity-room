import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    readonly children: React.ReactNode;
    readonly to: string;
    readonly [k: string]: unknown;
  }) =>
    createElement('a', { href: to, 'data-to': to, ...(rest as Record<string, unknown>) }, children),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: '/app/tracker' } }),
}));

import { MobileBottomNav, MOBILE_PRIMARY_NAV } from './mobile-bottom-nav';

describe('MobileBottomNav', () => {
  it('exposes exactly three primary destinations for gym-speed navigation', () => {
    expect(MOBILE_PRIMARY_NAV).toHaveLength(3);
    expect(MOBILE_PRIMARY_NAV.map((item) => item.to)).toEqual([
      '/app',
      '/app/tracker',
      '/app/programs',
    ]);
  });

  it('renders the three primary links with an accessible nav landmark', () => {
    render(<MobileBottomNav />);

    const nav = screen.getByRole('navigation', { name: /navegación móvil|mobile/i });
    expect(nav).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /inicio|home/i })).toHaveAttribute('data-to', '/app');
    expect(screen.getByRole('link', { name: /tracker/i })).toHaveAttribute(
      'data-to',
      '/app/tracker'
    );
    expect(screen.getByRole('link', { name: /programas|programs/i })).toHaveAttribute(
      'data-to',
      '/app/programs'
    );
  });

  it('marks the active route for the current pathname', () => {
    render(<MobileBottomNav />);
    const tracker = screen.getByRole('link', { name: /tracker/i });
    expect(tracker.getAttribute('aria-current')).toBe('page');
  });
});
