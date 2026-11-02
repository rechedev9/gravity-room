import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { UserInfo } from '@gzclp/domain/schemas/user';

let mockPathname = '/app';
const navigate = vi.fn();
const exitGuestModeKeepingData = vi.fn();
const signOut = vi.fn(() => Promise.resolve());
const state: { user: UserInfo | null; isGuest: boolean } = { user: null, isGuest: false };

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
  useNavigate: () => navigate,
}));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/contexts/guest-context', () => ({
  useGuest: () => ({ isGuest: state.isGuest, exitGuestModeKeepingData }),
}));
vi.mock('@/hooks/use-sign-out', () => ({ useSignOut: () => ({ signOut, failed: false }) }));
vi.mock('./desktop-program-card', () => ({
  DesktopProgramCard: () => createElement('div', { 'data-testid': 'program-card' }),
}));

import { AppSidebar } from './app-sidebar';

const USER: UserInfo = { id: 'u1', email: 'martin@example.com', name: 'Martín Rojas' };

beforeEach(() => {
  mockPathname = '/app';
  state.user = USER;
  state.isGuest = false;
  navigate.mockReset();
  exitGuestModeKeepingData.mockReset();
  signOut.mockClear();
});

function navLinks(): HTMLAnchorElement[] {
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
  return Array.from(nav.querySelectorAll('a[data-nav-item]'));
}

describe('AppSidebar (desktop shell)', () => {
  it('shows the GRAVITY ROOM wordmark and the five sections in the artboard order', () => {
    render(<AppSidebar />);
    const brand = screen.getByRole('link', { name: /gravity room/i });
    expect(brand.getAttribute('data-to')).toBe('/app');
    expect(brand.textContent).toContain('Registro de fuerza');
    expect(navLinks().map((a) => [a.textContent, a.getAttribute('data-to')])).toEqual([
      ['Hoy', '/app'],
      ['Entrenar', '/app/tracker'],
      ['Programas', '/app/programs'],
      ['Progreso', '/app/insights'],
      ['Ejercicios', '/app/exercises'],
    ]);
  });

  it.each([
    ['/app', 'Hoy'],
    ['/app/tracker/gzclp', 'Entrenar'],
    ['/app/programs', 'Programas'],
    ['/app/explore', 'Programas'],
    ['/app/insights', 'Progreso'],
    ['/app/exercises/back-squat', 'Ejercicios'],
  ])('marks exactly one item active on %s', (pathname, label) => {
    mockPathname = pathname;
    render(<AppSidebar />);
    const active = navLinks().filter((a) => a.getAttribute('aria-current') === 'page');
    expect(active.map((a) => a.textContent)).toEqual([label]);
  });

  it('marks no section active on the profile, which lives in the Cuenta menu', () => {
    mockPathname = '/app/profile';
    render(<AppSidebar />);
    expect(navLinks().filter((a) => a.getAttribute('aria-current') === 'page')).toHaveLength(0);
  });

  it('shows the program card and the Cuenta row for a signed-in user', () => {
    render(<AppSidebar />);
    expect(screen.getByTestId('program-card')).toBeTruthy();
    expect(screen.getByRole('button', { name: /cuenta/i }).textContent).toContain('Martín Rojas');
    expect(screen.queryByRole('button', { name: /crear cuenta/i })).toBeNull();
  });

  it('signs out from the Cuenta menu', () => {
    render(<AppSidebar />);
    fireEvent.click(screen.getByRole('button', { name: /cuenta/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('keeps "Crear cuenta" for guests, hides Progreso and has no account row', () => {
    state.user = null;
    state.isGuest = true;
    render(<AppSidebar />);
    expect(navLinks().map((a) => a.textContent)).toEqual([
      'Hoy',
      'Entrenar',
      'Programas',
      'Ejercicios',
    ]);
    expect(screen.queryByTestId('program-card')).toBeNull();
    expect(screen.queryByRole('button', { name: /^cuenta/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));
    expect(exitGuestModeKeepingData).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });

  it('offers "Iniciar sesión" when nobody is signed in', () => {
    state.user = null;
    render(<AppSidebar />);
    expect(screen.getByRole('link', { name: /iniciar sesión/i }).getAttribute('data-to')).toBe(
      '/login'
    );
  });
});
