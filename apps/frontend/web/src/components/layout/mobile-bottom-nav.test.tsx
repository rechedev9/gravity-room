import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';

let mockPathname = '/app/tracker';

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
    select({ location: { pathname: mockPathname } }),
}));

import { MobileBottomNav, MOBILE_TABS } from './mobile-bottom-nav';

function activeTabId(pathname: string): string | undefined {
  return MOBILE_TABS.find((tab) => tab.isActive(pathname))?.id;
}

describe('MobileBottomNav', () => {
  it('shows the same five tabs as the mobile app, in the same order', () => {
    mockPathname = '/app/tracker';
    render(<MobileBottomNav />);

    const nav = screen.getByRole('navigation', { name: /navegación móvil|mobile/i });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((link) => link.textContent)).toEqual([
      'Entrenar',
      'Mis planes',
      'Explorar',
      'Ejercicios',
      'Más',
    ]);
    expect(links.map((link) => link.getAttribute('data-to'))).toEqual([
      '/app/tracker',
      '/app/programs',
      '/app/explore',
      '/app/exercises',
      '/app/profile',
    ]);
  });

  it('marks the active tab for the current pathname', () => {
    mockPathname = '/app/programs';
    render(<MobileBottomNav />);
    expect(screen.getByRole('link', { name: 'Mis planes' }).getAttribute('aria-current')).toBe(
      'page'
    );
    expect(screen.getByRole('link', { name: 'Entrenar' }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps every /app destination under exactly one tab', () => {
    expect(activeTabId('/app')).toBe('train');
    expect(activeTabId('/app/start')).toBe('train');
    expect(activeTabId('/app/tracker/gzclp')).toBe('train');
    expect(activeTabId('/app/programs')).toBe('plans');
    expect(activeTabId('/app/explore')).toBe('explore');
    expect(activeTabId('/app/exercises/back-squat')).toBe('exercises');
    expect(activeTabId('/app/profile')).toBe('more');
    expect(activeTabId('/app/insights')).toBe('more');
  });

  it('flags the document so floating chrome can clear the bar', () => {
    mockPathname = '/app';
    const { unmount } = render(<MobileBottomNav />);
    expect(document.documentElement.hasAttribute('data-tab-bar')).toBe(true);
    unmount();
    expect(document.documentElement.hasAttribute('data-tab-bar')).toBe(false);
  });
});
