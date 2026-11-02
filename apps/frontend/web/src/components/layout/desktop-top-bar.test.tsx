import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockPathname = '/app';
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: mockPathname } }),
}));
vi.mock('@/components/online-indicator', () => ({ OnlineIndicator: () => null }));

import { DesktopTopBar, desktopPageTitleKey } from './desktop-top-bar';

describe('desktopPageTitleKey', () => {
  it.each([
    ['/app', 'desktop_shell.titles.today'],
    ['/app/start', 'desktop_shell.titles.start'],
    ['/app/tracker', 'desktop_shell.titles.train'],
    ['/app/tracker/gzclp', 'desktop_shell.titles.train'],
    ['/app/programs', 'desktop_shell.titles.programs'],
    ['/app/explore', 'desktop_shell.titles.programs'],
    ['/app/insights', 'desktop_shell.titles.progress'],
    ['/app/exercises/versus', 'desktop_shell.titles.exercises'],
    ['/app/profile', 'desktop_shell.titles.profile'],
  ])('maps %s to %s', (pathname, key) => {
    expect(desktopPageTitleKey(pathname)).toBe(key);
  });

  it('returns null for an unknown path', () => {
    expect(desktopPageTitleKey('/app/unknown')).toBeNull();
  });
});

describe('DesktopTopBar', () => {
  it('shows the current page title in a desktop-only banner', () => {
    mockPathname = '/app/insights';
    render(<DesktopTopBar />);
    const bar = screen.getByTestId('desktop-top-bar');
    expect(bar.className).toContain('hidden');
    expect(bar.className).toContain('lg:flex');
    expect(bar.textContent).toBe('Progreso');
  });
});
